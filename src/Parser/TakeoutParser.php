<?php

declare(strict_types=1);

namespace GuideMap\Parser;

use FilesystemIterator;
use GuideMap\ContributionType;
use GuideMap\Parser\Exception\InvalidJson;
use GuideMap\Parser\Exception\UnreadableFile;
use GuideMap\Parser\Exception\ZipExtractFailure;
use JsonException;
use RecursiveDirectoryIterator;
use RecursiveIteratorIterator;
use ZipArchive;

/**
 * Entry point of the parser layer: turns a Google Takeout export — a `.zip`,
 * or a single `.json`/`.geojson` file — into a {@see ParseResult}.
 *
 * Responsibilities kept here (and nowhere else): all filesystem I/O, zip
 * extraction and cleanup, JSON decoding, and routing each file to the right
 * type parser. The four type parsers stay pure functions of decoded arrays.
 *
 * Failure handling, per DECISIONS.md (D11):
 *  - a missing/unreadable input, or an unopenable zip, throws a typed
 *    {@see Exception\ParserException};
 *  - a single malformed or unrecognized file is recorded in
 *    {@see ParseResult::$errors} and does not abort the rest of the import.
 */
final class TakeoutParser
{
    private readonly ReviewsParser $reviewsParser;
    private readonly StarredParser $starredParser;
    private readonly PhotosParser $photosParser;
    private readonly QuestionsParser $questionsParser;

    public function __construct()
    {
        $this->reviewsParser = new ReviewsParser();
        $this->starredParser = new StarredParser();
        $this->photosParser = new PhotosParser();
        $this->questionsParser = new QuestionsParser();
    }

    /**
     * Parse a Takeout export.
     *
     * @throws UnreadableFile   the path is missing or unreadable
     * @throws ZipExtractFailure a `.zip` input could not be opened/extracted
     */
    public function parse(string $filePath): ParseResult
    {
        if (!is_file($filePath) || !is_readable($filePath)) {
            throw UnreadableFile::atPath($filePath);
        }

        if (strtolower(pathinfo($filePath, PATHINFO_EXTENSION)) === 'zip') {
            return $this->parseZip($filePath);
        }

        return $this->parseFiles([$filePath]);
    }

    /**
     * Extract a zip to a temp directory, parse every JSON file inside it, and
     * remove the temp directory afterwards no matter what.
     */
    private function parseZip(string $zipPath): ParseResult
    {
        $tempDir = sys_get_temp_dir() . '/guidemap-' . uniqid('', true);
        if (!mkdir($tempDir, 0700, true) && !is_dir($tempDir)) {
            throw ZipExtractFailure::cannotExtract($zipPath);
        }

        try {
            $this->extractZip($zipPath, $tempDir);

            return $this->parseFiles($this->findJsonFiles($tempDir));
        } finally {
            $this->deleteDirectory($tempDir);
        }
    }

    private function extractZip(string $zipPath, string $tempDir): void
    {
        $zip = new ZipArchive();
        $opened = $zip->open($zipPath);
        if ($opened !== true) {
            throw ZipExtractFailure::cannotOpen($zipPath, is_int($opened) ? $opened : -1);
        }

        try {
            if (!$zip->extractTo($tempDir)) {
                throw ZipExtractFailure::cannotExtract($zipPath);
            }
        } finally {
            $zip->close();
        }
    }

    /**
     * Decode, type-detect and parse each file, accumulating contributions and
     * per-file errors into a single result.
     *
     * @param list<string> $paths
     */
    private function parseFiles(array $paths): ParseResult
    {
        $contributions = [];
        $errors = [];
        $filesProcessed = 0;

        if ($paths === []) {
            $errors[] = 'No .json or .geojson files were found to parse.';
        }

        foreach ($paths as $path) {
            try {
                $data = $this->decode($path);
            } catch (InvalidJson $exception) {
                $errors[] = $exception->getMessage();
                continue;
            }

            $type = $this->detectType($path, $data);
            if ($type === null) {
                $errors[] = sprintf(
                    'Could not determine the contribution type of "%s"; file skipped.',
                    basename($path),
                );
                continue;
            }

            foreach ($this->parseByType($type, $data) as $contribution) {
                $contributions[] = $contribution;
            }
            $filesProcessed++;
        }

        return new ParseResult($contributions, $errors, $filesProcessed);
    }

    /**
     * Read a file and JSON-decode it to an array.
     *
     * @return array<string, mixed>
     *
     * @throws InvalidJson the file is unreadable or not valid JSON
     */
    private function decode(string $path): array
    {
        $raw = @file_get_contents($path);
        if ($raw === false) {
            throw InvalidJson::inFile($path, 'file could not be read');
        }

        try {
            $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            throw InvalidJson::inFile($path, $exception->getMessage());
        }

        if (!is_array($decoded)) {
            throw InvalidJson::inFile($path, 'top-level JSON value is not an object or array');
        }

        return $decoded;
    }

    /**
     * Decide which contribution type a file holds. Filename keywords are
     * tried first; an inconclusive name falls back to inspecting the JSON
     * structure.
     *
     * @param array<string, mixed> $data
     */
    private function detectType(string $path, array $data): ?ContributionType
    {
        $name = strtolower(basename($path));

        if (str_contains($name, 'review')) {
            return ContributionType::Review;
        }
        if (str_contains($name, 'question')) {
            return ContributionType::Question;
        }
        if (str_contains($name, 'photo')) {
            return ContributionType::Photo;
        }
        if (str_contains($name, 'starred') || str_contains($name, 'saved')) {
            return ContributionType::Starred;
        }

        return $this->detectByStructure($data);
    }

    /**
     * Identify a contribution type from the shape of the data when the
     * filename was not informative.
     *
     * @param array<string, mixed> $data
     */
    private function detectByStructure(array $data): ?ContributionType
    {
        $record = $this->firstRecord($data);
        if ($record === null) {
            return null;
        }

        $props = (isset($record['properties']) && is_array($record['properties']))
            ? $record['properties']
            : $record;

        $keys = array_map(
            'strtolower',
            array_merge(array_keys($record), array_keys($props)),
        );
        $has = static fn (string ...$needles): bool
            => array_intersect($needles, $keys) !== [];

        if ($has('geodataexif', 'phototakentime', 'imageviews', 'image_views')) {
            return ContributionType::Photo;
        }
        if ($has('question_text', 'question text', 'question', 'published_question')) {
            return ContributionType::Question;
        }
        if ($has(
            'five_star_rating_published',
            'star_rating',
            'star rating',
            'star_rating_published',
            'stars',
            'rating',
            'review_text',
            'review text',
            'review_text_published',
            'published_review',
        )) {
            return ContributionType::Review;
        }
        if (isset($record['geometry']) || $has('latitude', 'lat', 'location')) {
            return ContributionType::Starred;
        }

        return null;
    }

    /**
     * Return the first array-shaped record in a file, unwrapping any known
     * collection wrapper or top-level list.
     *
     * @param array<string, mixed> $data
     *
     * @return array<string, mixed>|null
     */
    private function firstRecord(array $data): ?array
    {
        $wrappers = ['features', 'reviews', 'photos', 'questions', 'starred',
            'saved', 'places', 'items', 'mediaItems'];
        foreach ($wrappers as $key) {
            if (isset($data[$key]) && is_array($data[$key])) {
                foreach ($data[$key] as $item) {
                    if (is_array($item)) {
                        return $item;
                    }
                }

                return null;
            }
        }

        if (array_is_list($data)) {
            foreach ($data as $item) {
                if (is_array($item)) {
                    return $item;
                }
            }

            return null;
        }

        return $data === [] ? null : $data;
    }

    /**
     * @param array<string, mixed> $data
     *
     * @return list<\GuideMap\Contribution>
     */
    private function parseByType(ContributionType $type, array $data): array
    {
        return match ($type) {
            ContributionType::Review => $this->reviewsParser->parse($data),
            ContributionType::Starred => $this->starredParser->parse($data),
            ContributionType::Photo => $this->photosParser->parse($data),
            ContributionType::Question => $this->questionsParser->parse($data),
        };
    }

    /**
     * Recursively collect every `.json` / `.geojson` file under a directory,
     * sorted for deterministic processing order.
     *
     * @return list<string>
     */
    private function findJsonFiles(string $directory): array
    {
        $found = [];
        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS),
        );
        foreach ($iterator as $file) {
            if (!$file->isFile()) {
                continue;
            }
            $extension = strtolower($file->getExtension());
            if ($extension === 'json' || $extension === 'geojson') {
                $found[] = $file->getPathname();
            }
        }
        sort($found);

        return $found;
    }

    /**
     * Remove a directory and everything beneath it. Best-effort: never throws,
     * so it is safe to call from a `finally` block.
     */
    private function deleteDirectory(string $directory): void
    {
        if (!is_dir($directory)) {
            return;
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST,
        );
        foreach ($iterator as $item) {
            if ($item->isDir()) {
                @rmdir($item->getPathname());
            } else {
                @unlink($item->getPathname());
            }
        }
        @rmdir($directory);
    }
}

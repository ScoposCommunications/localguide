<?php

declare(strict_types=1);

namespace GuideMap\Tests\Parser;

use GuideMap\Parser\Exception\UnreadableFile;
use GuideMap\Parser\Exception\ZipExtractFailure;
use GuideMap\Parser\TakeoutParser;
use GuideMap\Tests\TestCase;
use ZipArchive;

final class TakeoutParserTest extends TestCase
{
    /** @var list<string> */
    private array $tempPaths = [];

    protected function tearDown(): void
    {
        foreach ($this->tempPaths as $path) {
            if (is_file($path)) {
                @unlink($path);
            }
        }
        $this->tempPaths = [];
        parent::tearDown();
    }

    private function tempFile(string $suffix, string $contents): string
    {
        $path = sys_get_temp_dir() . '/guidemap-unit-' . uniqid('', true) . $suffix;
        file_put_contents($path, $contents);
        $this->tempPaths[] = $path;

        return $path;
    }

    /**
     * @param array<string, string> $entries zip entry name => contents
     */
    private function tempZip(array $entries): string
    {
        $path = sys_get_temp_dir() . '/guidemap-unit-' . uniqid('', true) . '.zip';
        $zip = new ZipArchive();
        $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        foreach ($entries as $name => $contents) {
            $zip->addFromString($name, $contents);
        }
        $zip->close();
        $this->tempPaths[] = $path;

        return $path;
    }

    /** @return list<string> */
    private function guidemapTempDirs(): array
    {
        $dirs = array_filter((array) glob(sys_get_temp_dir() . '/guidemap-*'), 'is_dir');
        sort($dirs);

        return array_values($dirs);
    }

    public function test_parses_the_bundled_sample_zip(): void
    {
        $result = (new TakeoutParser())->parse($this->fixturePath('takeout-sample.zip'));

        self::assertSame(16, $result->contributionCount());
        self::assertSame(4, $result->filesProcessed);
        self::assertFalse($result->hasErrors());

        $counts = $result->countsByType();
        self::assertSame(5, $counts['review']);
        self::assertSame(4, $counts['photo']);
        self::assertSame(4, $counts['starred']);
        self::assertSame(3, $counts['question']);
    }

    public function test_parses_a_single_json_file_routed_by_filename(): void
    {
        $result = (new TakeoutParser())->parse($this->fixturePath('reviews.json'));

        self::assertSame(5, $result->contributionCount());
        self::assertSame(1, $result->filesProcessed);
        self::assertFalse($result->hasErrors());
    }

    public function test_detects_the_type_from_structure_when_the_filename_is_uninformative(): void
    {
        // A generic filename carries no "reviews"/"photos"/etc. keyword, so
        // the parser must fall back to inspecting the JSON shape.
        $path = $this->tempFile('.json', (string) file_get_contents($this->fixturePath('reviews.json')));

        $result = (new TakeoutParser())->parse($path);

        self::assertSame(5, $result->contributionCount());
        self::assertSame(1, $result->filesProcessed);
    }

    public function test_accepts_a_geojson_extension(): void
    {
        $path = $this->tempFile('.geojson', (string) file_get_contents($this->fixturePath('starred.json')));

        $result = (new TakeoutParser())->parse($path);

        self::assertSame(4, $result->contributionCount());
        self::assertSame(1, $result->filesProcessed);
    }

    public function test_one_malformed_file_does_not_abort_the_rest_of_the_import(): void
    {
        $zip = $this->tempZip([
            'Takeout/Maps/Reviews.json' => (string) file_get_contents($this->fixturePath('reviews.json')),
            'Takeout/Maps/Broken.json' => '{ "features": [ this is not valid json',
        ]);

        $result = (new TakeoutParser())->parse($zip);

        self::assertSame(5, $result->contributionCount());
        self::assertSame(1, $result->filesProcessed);
        self::assertTrue($result->hasErrors());
        self::assertCount(1, $result->errors);
        self::assertStringContainsString('Broken.json', $result->errors[0]);
    }

    public function test_records_an_error_for_an_unrecognized_file(): void
    {
        $path = $this->tempFile('.json', '{"foo": "bar", "baz": 123}');

        $result = (new TakeoutParser())->parse($path);

        self::assertSame(0, $result->contributionCount());
        self::assertSame(0, $result->filesProcessed);
        self::assertCount(1, $result->errors);
        self::assertStringContainsString('Could not determine', $result->errors[0]);
    }

    public function test_reports_an_error_when_a_zip_contains_no_json(): void
    {
        $zip = $this->tempZip(['Takeout/readme.txt' => 'nothing to parse here']);

        $result = (new TakeoutParser())->parse($zip);

        self::assertSame(0, $result->contributionCount());
        self::assertSame(0, $result->filesProcessed);
        self::assertTrue($result->hasErrors());
        self::assertStringContainsString('No .json', $result->errors[0]);
    }

    public function test_throws_for_a_missing_input_path(): void
    {
        $this->expectException(UnreadableFile::class);

        (new TakeoutParser())->parse('/tmp/guidemap-does-not-exist-' . uniqid() . '.zip');
    }

    public function test_throws_for_a_corrupt_zip(): void
    {
        $path = $this->tempFile('.zip', 'this is plainly not a zip archive');

        $this->expectException(ZipExtractFailure::class);

        (new TakeoutParser())->parse($path);
    }

    public function test_removes_its_temporary_extraction_directory(): void
    {
        $before = $this->guidemapTempDirs();

        (new TakeoutParser())->parse($this->fixturePath('takeout-sample.zip'));

        self::assertSame(
            $before,
            $this->guidemapTempDirs(),
            'The zip extraction directory should be cleaned up after parsing.',
        );
    }
}

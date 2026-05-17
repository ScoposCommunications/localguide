<?php

declare(strict_types=1);

namespace GuideMap\Tests\Sync;

use GuideMap\Clock\Clock;
use GuideMap\Clock\FrozenClock;
use GuideMap\Drive\DriveClient;
use GuideMap\Http\FakeHttpClient;
use GuideMap\Http\HttpResponse;
use GuideMap\OAuth\StaticTokenProvider;
use GuideMap\Parser\TakeoutParser;
use GuideMap\Storage\ContributionRepository;
use GuideMap\Storage\SqliteContributionRepository;
use GuideMap\Sync\InMemoryProcessedFilesStore;
use GuideMap\Sync\ProcessedFilesStore;
use GuideMap\Sync\SyncOrchestrator;
use GuideMap\Tests\TestCase;
use ZipArchive;

final class SyncOrchestratorTest extends TestCase
{
    private const FILES = 'https://www.googleapis.com/drive/v3/files';

    private function orchestrator(
        FakeHttpClient $http,
        ContributionRepository $repository,
        ProcessedFilesStore $store,
        ?Clock $clock = null,
    ): SyncOrchestrator {
        return new SyncOrchestrator(
            new DriveClient(new StaticTokenProvider(), $http),
            new TakeoutParser(),
            $repository,
            $store,
            $clock ?? FrozenClock::at('2026-05-17T12:00:00'),
        );
    }

    /**
     * @param list<array<string, mixed>> $entries
     */
    private function listResponse(array $entries): HttpResponse
    {
        return new HttpResponse(200, [], (string) json_encode(['files' => $entries], JSON_THROW_ON_ERROR));
    }

    /**
     * @return array<string, mixed>
     */
    private function entry(string $id, string $name): array
    {
        return [
            'id' => $id,
            'name' => $name,
            'mimeType' => 'application/zip',
            'modifiedTime' => '2026-05-17T10:00:00.000Z',
            'size' => '1024',
        ];
    }

    /**
     * Build the bytes of a zip containing one Reviews.json with a review for
     * each given URL.
     */
    private function reviewsZipBytes(string ...$urls): string
    {
        $features = [];
        foreach ($urls as $index => $url) {
            $features[] = [
                'geometry' => ['coordinates' => [$index + 1.0, $index + 1.0]],
                'properties' => [
                    'name' => 'Place for ' . $url,
                    'google_maps_url' => $url,
                    'date' => '2021-05-05',
                    'star_rating' => 5,
                    'review_text' => 'A review of ' . $url,
                ],
            ];
        }

        return $this->zipBytes('Takeout/Maps/Reviews.json', (string) json_encode(
            ['type' => 'FeatureCollection', 'features' => $features],
            JSON_THROW_ON_ERROR,
        ));
    }

    private function zipBytes(string $entryName, string $contents): string
    {
        $path = sys_get_temp_dir() . '/guidemap-synctest-' . uniqid('', true) . '.zip';
        $zip = new ZipArchive();
        $zip->open($path, ZipArchive::CREATE | ZipArchive::OVERWRITE);
        $zip->addFromString($entryName, $contents);
        $zip->close();
        $bytes = (string) file_get_contents($path);
        @unlink($path);

        return $bytes;
    }

    public function test_a_fresh_sync_processes_every_new_file(): void
    {
        $http = new FakeHttpClient([
            'GET ' . self::FILES => $this->listResponse([
                $this->entry('f1', 'takeout-1.zip'),
                $this->entry('f2', 'takeout-2.zip'),
                $this->entry('f3', 'takeout-3.zip'),
            ]),
            'GET ' . self::FILES . '/f1' => new HttpResponse(200, [], $this->reviewsZipBytes('u1', 'u2')),
            'GET ' . self::FILES . '/f2' => new HttpResponse(200, [], $this->reviewsZipBytes('u3')),
            'GET ' . self::FILES . '/f3' => new HttpResponse(200, [], $this->reviewsZipBytes('u4', 'u5', 'u6')),
        ]);
        $repository = SqliteContributionRepository::inMemory();
        $store = new InMemoryProcessedFilesStore();

        $result = $this->orchestrator($http, $repository, $store)->run('folder-1');

        self::assertSame(3, $result->filesScanned);
        self::assertSame(3, $result->filesProcessed);
        self::assertSame(6, $result->contributionsInserted);
        self::assertSame(0, $result->contributionsSkipped);
        self::assertFalse($result->hasErrors());
        self::assertSame(6, $repository->count());
        self::assertCount(3, $store->all());
    }

    public function test_re_syncing_the_same_folder_is_idempotent(): void
    {
        $http = new FakeHttpClient([
            'GET ' . self::FILES => $this->listResponse([
                $this->entry('f1', 'takeout-1.zip'),
                $this->entry('f2', 'takeout-2.zip'),
            ]),
            'GET ' . self::FILES . '/f1' => new HttpResponse(200, [], $this->reviewsZipBytes('u1')),
            'GET ' . self::FILES . '/f2' => new HttpResponse(200, [], $this->reviewsZipBytes('u2')),
        ]);
        $repository = SqliteContributionRepository::inMemory();
        $store = new InMemoryProcessedFilesStore();
        $orchestrator = $this->orchestrator($http, $repository, $store);

        $orchestrator->run('folder-1');
        $second = $orchestrator->run('folder-1');

        self::assertSame(2, $second->filesScanned);
        self::assertSame(0, $second->filesProcessed);
        self::assertSame(0, $second->contributionsInserted);
        self::assertSame(2, $repository->count());
    }

    public function test_only_newly_appeared_files_are_processed(): void
    {
        $store = new InMemoryProcessedFilesStore();
        $store->markProcessed('f1');
        $store->markProcessed('f2');

        $http = new FakeHttpClient([
            'GET ' . self::FILES => $this->listResponse([
                $this->entry('f1', 'takeout-1.zip'),
                $this->entry('f2', 'takeout-2.zip'),
                $this->entry('f3', 'takeout-3.zip'),
            ]),
            'GET ' . self::FILES . '/f3' => new HttpResponse(200, [], $this->reviewsZipBytes('u-new')),
        ]);
        $repository = SqliteContributionRepository::inMemory();

        $result = $this->orchestrator($http, $repository, $store)->run('folder-1');

        self::assertSame(3, $result->filesScanned);
        self::assertSame(1, $result->filesProcessed);
        self::assertSame(1, $result->contributionsInserted);
        self::assertSame(1, $repository->count());
    }

    public function test_a_corrupt_file_does_not_stop_the_others(): void
    {
        $http = new FakeHttpClient([
            'GET ' . self::FILES => $this->listResponse([
                $this->entry('f1', 'takeout-1.zip'),
                $this->entry('f2', 'takeout-2.zip'),
                $this->entry('f3', 'takeout-3.zip'),
            ]),
            'GET ' . self::FILES . '/f1' => new HttpResponse(200, [], $this->reviewsZipBytes('u1')),
            'GET ' . self::FILES . '/f2' => new HttpResponse(200, [], 'this is not a valid zip archive'),
            'GET ' . self::FILES . '/f3' => new HttpResponse(200, [], $this->reviewsZipBytes('u3')),
        ]);
        $repository = SqliteContributionRepository::inMemory();
        $store = new InMemoryProcessedFilesStore();

        $result = $this->orchestrator($http, $repository, $store)->run('folder-1');

        self::assertSame(3, $result->filesScanned);
        self::assertSame(2, $result->filesProcessed);
        self::assertSame(2, $result->contributionsInserted);
        self::assertCount(1, $result->errors);
        self::assertStringContainsString('takeout-2.zip', $result->errors[0]);
        // The failed file is left unmarked so a later sync retries it.
        self::assertFalse($store->has('f2'));
        self::assertTrue($store->has('f1'));
        self::assertTrue($store->has('f3'));
    }

    public function test_a_download_failure_is_logged_and_the_sync_continues(): void
    {
        $http = new FakeHttpClient([
            'GET ' . self::FILES => $this->listResponse([
                $this->entry('f1', 'takeout-1.zip'),
                $this->entry('f2', 'takeout-2.zip'),
                $this->entry('f3', 'takeout-3.zip'),
            ]),
            'GET ' . self::FILES . '/f1' => new HttpResponse(200, [], $this->reviewsZipBytes('u1')),
            'GET ' . self::FILES . '/f2' => new HttpResponse(500, [], 'internal server error'),
            'GET ' . self::FILES . '/f3' => new HttpResponse(200, [], $this->reviewsZipBytes('u3')),
        ]);
        $repository = SqliteContributionRepository::inMemory();
        $store = new InMemoryProcessedFilesStore();

        $result = $this->orchestrator($http, $repository, $store)->run('folder-1');

        self::assertSame(2, $result->filesProcessed);
        self::assertSame(2, $result->contributionsInserted);
        self::assertCount(1, $result->errors);
        self::assertStringContainsString('takeout-2.zip', $result->errors[0]);
        self::assertFalse($store->has('f2'));
    }

    public function test_duplicate_contributions_across_files_are_counted_as_skipped(): void
    {
        $http = new FakeHttpClient([
            'GET ' . self::FILES => $this->listResponse([
                $this->entry('f1', 'takeout-1.zip'),
                $this->entry('f2', 'takeout-2.zip'),
            ]),
            'GET ' . self::FILES . '/f1' => new HttpResponse(200, [], $this->reviewsZipBytes('same-place')),
            'GET ' . self::FILES . '/f2' => new HttpResponse(200, [], $this->reviewsZipBytes('same-place')),
        ]);
        $repository = SqliteContributionRepository::inMemory();
        $store = new InMemoryProcessedFilesStore();

        $result = $this->orchestrator($http, $repository, $store)->run('folder-1');

        self::assertSame(2, $result->filesProcessed);
        self::assertSame(1, $result->contributionsInserted);
        self::assertSame(1, $result->contributionsSkipped);
        self::assertSame(1, $repository->count());
    }

    public function test_parse_level_skips_are_surfaced_in_the_errors(): void
    {
        $reviews = (string) json_encode([
            'type' => 'FeatureCollection',
            'features' => [
                [
                    'geometry' => ['coordinates' => [1.0, 2.0]],
                    'properties' => ['name' => 'No Date Place', 'google_maps_url' => 'u1', 'star_rating' => 5],
                ],
                [
                    'geometry' => ['coordinates' => [3.0, 4.0]],
                    'properties' => [
                        'name' => 'Dated Place',
                        'google_maps_url' => 'u2',
                        'date' => '2020-01-01',
                        'star_rating' => 4,
                    ],
                ],
            ],
        ], JSON_THROW_ON_ERROR);

        $http = new FakeHttpClient([
            'GET ' . self::FILES => $this->listResponse([$this->entry('f1', 'takeout-1.zip')]),
            'GET ' . self::FILES . '/f1' => new HttpResponse(
                200,
                [],
                $this->zipBytes('Takeout/Maps/Reviews.json', $reviews),
            ),
        ]);
        $repository = SqliteContributionRepository::inMemory();

        $result = $this->orchestrator($http, $repository, new InMemoryProcessedFilesStore())
            ->run('folder-1');

        self::assertSame(1, $result->filesProcessed);
        self::assertSame(1, $result->contributionsInserted);
        self::assertCount(1, $result->errors);
        self::assertStringContainsString('takeout-1.zip', $result->errors[0]);
        self::assertStringContainsString('no parseable date', $result->errors[0]);
    }

    public function test_stamps_the_result_with_the_clock_time(): void
    {
        $http = new FakeHttpClient(['GET ' . self::FILES => $this->listResponse([])]);

        $result = $this->orchestrator(
            $http,
            SqliteContributionRepository::inMemory(),
            new InMemoryProcessedFilesStore(),
            FrozenClock::at('2026-05-17T09:30:00'),
        )->run('folder-1');

        self::assertSame(0, $result->filesScanned);
        self::assertSame('2026-05-17 09:30:00', $result->syncedAt->format('Y-m-d H:i:s'));
    }
}

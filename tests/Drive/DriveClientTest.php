<?php

declare(strict_types=1);

namespace GuideMap\Tests\Drive;

use GuideMap\Drive\DriveClient;
use GuideMap\Drive\Exception\DriveApiError;
use GuideMap\Drive\Exception\FileNotFound;
use GuideMap\Drive\Exception\RateLimited;
use GuideMap\Http\FakeHttpClient;
use GuideMap\Http\HttpResponse;
use GuideMap\OAuth\StaticTokenProvider;
use GuideMap\Tests\TestCase;

final class DriveClientTest extends TestCase
{
    private const FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
    private const FOLDER_ID = 'folder-123';

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

    private function tempPath(): string
    {
        $path = sys_get_temp_dir() . '/guidemap-drive-' . uniqid('', true) . '.zip';
        $this->tempPaths[] = $path;

        return $path;
    }

    /**
     * @param list<array<string, mixed>> $files
     */
    private function listResponse(array $files, ?string $nextPageToken = null): HttpResponse
    {
        $payload = ['files' => $files];
        if ($nextPageToken !== null) {
            $payload['nextPageToken'] = $nextPageToken;
        }

        return new HttpResponse(200, [], (string) json_encode($payload, JSON_THROW_ON_ERROR));
    }

    /**
     * @return array<string, mixed>
     */
    private function driveFile(string $id, string $name): array
    {
        return [
            'id' => $id,
            'name' => $name,
            'mimeType' => 'application/zip',
            'modifiedTime' => '2026-05-17T12:00:00.000Z',
            'size' => '2048',
        ];
    }

    public function test_lists_the_files_in_a_folder(): void
    {
        $http = new FakeHttpClient([
            'GET ' . self::FILES_ENDPOINT => $this->listResponse([
                $this->driveFile('f1', 'takeout-20260101.zip'),
                $this->driveFile('f2', 'takeout-20260201.zip'),
            ]),
        ]);

        $files = (new DriveClient(new StaticTokenProvider(), $http))
            ->listFolderFiles(self::FOLDER_ID);

        self::assertCount(2, $files);
        self::assertSame('f1', $files[0]->id);
        self::assertSame('takeout-20260101.zip', $files[0]->name);
        self::assertSame('application/zip', $files[0]->mimeType);
        self::assertSame(2048, $files[0]->size);
        self::assertSame('2026-05-17', $files[0]->modifiedTime->format('Y-m-d'));
    }

    public function test_name_pattern_filters_the_listing_client_side(): void
    {
        $http = new FakeHttpClient([
            'GET ' . self::FILES_ENDPOINT => $this->listResponse([
                $this->driveFile('f1', 'takeout-20260101.zip'),
                $this->driveFile('f2', 'takeout-readme.txt'),
            ]),
        ]);

        $files = (new DriveClient(new StaticTokenProvider(), $http))
            ->listFolderFiles(self::FOLDER_ID);

        self::assertCount(1, $files);
        self::assertSame('takeout-20260101.zip', $files[0]->name);
    }

    public function test_an_empty_folder_yields_no_files(): void
    {
        $http = new FakeHttpClient([
            'GET ' . self::FILES_ENDPOINT => $this->listResponse([]),
        ]);

        $files = (new DriveClient(new StaticTokenProvider(), $http))
            ->listFolderFiles(self::FOLDER_ID);

        self::assertSame([], $files);
    }

    public function test_listing_follows_pagination(): void
    {
        $http = new FakeHttpClient([
            'GET ' . self::FILES_ENDPOINT => [
                $this->listResponse([$this->driveFile('f1', 'takeout-1.zip')], 'PAGE2TOKEN'),
                $this->listResponse([$this->driveFile('f2', 'takeout-2.zip')]),
            ],
        ]);

        $files = (new DriveClient(new StaticTokenProvider(), $http))
            ->listFolderFiles(self::FOLDER_ID);

        self::assertSame(['f1', 'f2'], array_map(static fn ($f) => $f->id, $files));
        self::assertSame(2, $http->requestCount());
        self::assertStringContainsString('pageToken=PAGE2TOKEN', (string) $http->lastRequest()['url']);
    }

    public function test_a_429_while_listing_throws_rate_limited(): void
    {
        $http = new FakeHttpClient([
            'GET ' . self::FILES_ENDPOINT => new HttpResponse(429, [], 'rate limited'),
        ]);

        $this->expectException(RateLimited::class);
        (new DriveClient(new StaticTokenProvider(), $http))->listFolderFiles(self::FOLDER_ID);
    }

    public function test_a_server_error_while_listing_throws_drive_api_error(): void
    {
        $http = new FakeHttpClient([
            'GET ' . self::FILES_ENDPOINT => new HttpResponse(500, [], 'internal error'),
        ]);

        $this->expectException(DriveApiError::class);
        (new DriveClient(new StaticTokenProvider(), $http))->listFolderFiles(self::FOLDER_ID);
    }

    public function test_downloads_a_file_to_disk(): void
    {
        $http = new FakeHttpClient([
            'GET ' . self::FILES_ENDPOINT . '/file-1' => new HttpResponse(200, [], 'ZIP-CONTENT-HERE'),
        ]);
        $path = $this->tempPath();

        (new DriveClient(new StaticTokenProvider(), $http))->downloadFile('file-1', $path);

        self::assertFileExists($path);
        self::assertSame('ZIP-CONTENT-HERE', file_get_contents($path));
    }

    public function test_downloading_a_missing_file_throws_and_leaves_no_file_behind(): void
    {
        $http = new FakeHttpClient([
            'GET ' . self::FILES_ENDPOINT . '/missing' => new HttpResponse(404, [], '{"error":"not found"}'),
        ]);
        $path = $this->tempPath();
        $client = new DriveClient(new StaticTokenProvider(), $http);

        try {
            $client->downloadFile('missing', $path);
            self::fail('Expected FileNotFound to be thrown.');
        } catch (FileNotFound) {
            self::assertFileDoesNotExist($path);
        }
    }

    public function test_a_429_while_downloading_throws_rate_limited(): void
    {
        $http = new FakeHttpClient([
            'GET ' . self::FILES_ENDPOINT . '/throttled' => new HttpResponse(429, [], 'slow down'),
        ]);

        $this->expectException(RateLimited::class);
        (new DriveClient(new StaticTokenProvider(), $http))
            ->downloadFile('throttled', $this->tempPath());
    }

    public function test_requests_carry_a_bearer_authorization_header(): void
    {
        $http = new FakeHttpClient([
            'GET ' . self::FILES_ENDPOINT => $this->listResponse([]),
        ]);

        (new DriveClient(new StaticTokenProvider('my-access-token'), $http))
            ->listFolderFiles(self::FOLDER_ID);

        $request = $http->lastRequest();
        self::assertNotNull($request);
        self::assertSame('Bearer my-access-token', $request['headers']['Authorization']);
    }

    public function test_list_query_targets_the_requested_folder(): void
    {
        $http = new FakeHttpClient([
            'GET ' . self::FILES_ENDPOINT => $this->listResponse([]),
        ]);

        (new DriveClient(new StaticTokenProvider(), $http))->listFolderFiles('my-special-folder');

        $url = urldecode((string) $http->lastRequest()['url']);
        self::assertStringContainsString("'my-special-folder' in parents", $url);
        self::assertStringContainsString('trashed = false', $url);
    }
}

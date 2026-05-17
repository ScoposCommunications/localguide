<?php

declare(strict_types=1);

namespace GuideMap\Drive;

use DateTimeImmutable;
use DateTimeZone;
use Exception;
use GuideMap\Drive\Exception\DriveApiError;
use GuideMap\Drive\Exception\FileNotFound;
use GuideMap\Drive\Exception\RateLimited;
use GuideMap\Http\HttpClient;
use GuideMap\OAuth\TokenProvider;

/**
 * A thin client for the slice of the Google Drive v3 API that GuideMap Pro
 * needs: listing the Takeout export files in a folder, and downloading one.
 *
 * Every request is authorized with a bearer token from the injected
 * {@see TokenProvider}; all I/O goes through the injected {@see HttpClient}.
 * Both are interfaces, so the whole client runs against
 * {@see \GuideMap\Http\FakeHttpClient} in tests with no network.
 */
final class DriveClient
{
    private const FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
    private const PAGE_SIZE = 100;

    public function __construct(
        private readonly TokenProvider $tokenProvider,
        private readonly HttpClient $http,
    ) {
    }

    /**
     * List the Takeout export files in a Drive folder.
     *
     * Drive filters server-side to non-trashed files in the folder whose name
     * contains "takeout"; `$namePattern` is then applied client-side as a
     * case-insensitive glob (default `*.zip`). All result pages are followed.
     *
     * @return list<DriveFile>
     *
     * @throws RateLimited  Drive returned HTTP 429
     * @throws DriveApiError any other non-2xx, or an unreadable response
     */
    public function listFolderFiles(string $folderId, string $namePattern = '*.zip'): array
    {
        $files = [];
        $pageToken = null;

        do {
            $page = $this->fetchPage($folderId, $pageToken);
            foreach ($page['files'] as $raw) {
                $file = $this->toDriveFile($raw);
                if ($file !== null && fnmatch($namePattern, $file->name, FNM_CASEFOLD)) {
                    $files[] = $file;
                }
            }
            $pageToken = $page['nextPageToken'];
        } while ($pageToken !== null);

        return $files;
    }

    /**
     * Download one Drive file, streaming it straight to disk (DECISIONS.md D18).
     *
     * @throws FileNotFound  the file id does not exist (HTTP 404)
     * @throws RateLimited   Drive returned HTTP 429
     * @throws DriveApiError any other non-2xx status
     */
    public function downloadFile(string $fileId, string $destinationPath): void
    {
        $url = self::FILES_ENDPOINT . '/' . rawurlencode($fileId) . '?alt=media';

        $response = $this->http->download('GET', $url, $destinationPath, $this->authHeaders());
        if ($response->isSuccess()) {
            return;
        }

        // A failed download still streamed an error body to disk — drop it.
        if (is_file($destinationPath)) {
            @unlink($destinationPath);
        }

        throw match ($response->statusCode) {
            404 => FileNotFound::withId($fileId),
            429 => RateLimited::whileDownloading($fileId),
            default => DriveApiError::unexpectedStatus(
                $response->statusCode,
                'downloading file "' . $fileId . '"',
            ),
        };
    }

    /**
     * Fetch one page of the folder listing.
     *
     * @return array{files: list<array<string, mixed>>, nextPageToken: ?string}
     */
    private function fetchPage(string $folderId, ?string $pageToken): array
    {
        $params = [
            'q' => sprintf(
                "'%s' in parents and name contains 'takeout' and trashed = false",
                $folderId,
            ),
            // nextPageToken must be requested explicitly, or Drive omits it.
            'fields' => 'nextPageToken,files(id,name,mimeType,modifiedTime,size)',
            'pageSize' => self::PAGE_SIZE,
        ];
        if ($pageToken !== null) {
            $params['pageToken'] = $pageToken;
        }

        $response = $this->http->request(
            'GET',
            self::FILES_ENDPOINT . '?' . http_build_query($params),
            $this->authHeaders(),
        );

        if ($response->statusCode === 429) {
            throw RateLimited::whileListing($folderId);
        }
        if (!$response->isSuccess()) {
            throw DriveApiError::unexpectedStatus(
                $response->statusCode,
                'listing folder "' . $folderId . '"',
            );
        }

        $decoded = json_decode($response->body, true);
        if (!is_array($decoded)) {
            throw DriveApiError::malformedResponse('listing folder "' . $folderId . '"');
        }

        $rawFiles = $decoded['files'] ?? [];
        $nextPageToken = $decoded['nextPageToken'] ?? null;

        return [
            'files' => is_array($rawFiles)
                ? array_values(array_filter($rawFiles, 'is_array'))
                : [],
            'nextPageToken' => is_string($nextPageToken) && $nextPageToken !== ''
                ? $nextPageToken
                : null,
        ];
    }

    /**
     * @return array<string, string>
     */
    private function authHeaders(): array
    {
        return ['Authorization' => 'Bearer ' . $this->tokenProvider->getAccessToken()];
    }

    /**
     * Convert one raw Drive file object into a {@see DriveFile}, or null when
     * it has no usable id.
     *
     * @param array<string, mixed> $raw
     */
    private function toDriveFile(array $raw): ?DriveFile
    {
        if (!isset($raw['id']) || !is_string($raw['id']) || $raw['id'] === '') {
            return null;
        }

        return new DriveFile(
            id: $raw['id'],
            name: isset($raw['name']) && is_string($raw['name']) ? $raw['name'] : '',
            mimeType: isset($raw['mimeType']) && is_string($raw['mimeType']) ? $raw['mimeType'] : '',
            modifiedTime: $this->parseTime($raw['modifiedTime'] ?? null),
            size: isset($raw['size']) && is_numeric($raw['size']) ? (int) $raw['size'] : 0,
        );
    }

    private function parseTime(mixed $value): DateTimeImmutable
    {
        if (is_string($value) && $value !== '') {
            try {
                return (new DateTimeImmutable($value))->setTimezone(new DateTimeZone('UTC'));
            } catch (Exception) {
                // Unparseable — fall through to the epoch sentinel.
            }
        }

        return new DateTimeImmutable('@0');
    }
}

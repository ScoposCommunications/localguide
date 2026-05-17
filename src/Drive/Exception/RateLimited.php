<?php

declare(strict_types=1);

namespace GuideMap\Drive\Exception;

/**
 * Google Drive returned HTTP 429 — the request was rate limited.
 *
 * Unlike most {@see DriveApiError}s this is transient: backing off and
 * retrying later is expected to succeed.
 */
final class RateLimited extends DriveApiError
{
    public static function whileListing(string $folderId): self
    {
        return new self(sprintf(
            'Google Drive rate limit reached (HTTP 429) while listing folder "%s".',
            $folderId,
        ));
    }

    public static function whileDownloading(string $fileId): self
    {
        return new self(sprintf(
            'Google Drive rate limit reached (HTTP 429) while downloading file "%s".',
            $fileId,
        ));
    }
}

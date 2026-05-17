<?php

declare(strict_types=1);

namespace GuideMap\Drive\Exception;

/**
 * A specific Google Drive file could not be found (HTTP 404) — typically
 * because it was deleted between being listed and being downloaded.
 */
final class FileNotFound extends DriveApiError
{
    public static function withId(string $fileId): self
    {
        return new self(sprintf('Google Drive file "%s" was not found (HTTP 404).', $fileId));
    }
}

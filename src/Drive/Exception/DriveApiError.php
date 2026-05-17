<?php

declare(strict_types=1);

namespace GuideMap\Drive\Exception;

use RuntimeException;

/**
 * A Google Drive API call failed.
 *
 * This is the base type for every Drive error — catching it catches
 * {@see FileNotFound} and {@see RateLimited} too — and is also thrown directly
 * for unexpected statuses and unreadable responses.
 */
class DriveApiError extends RuntimeException
{
    public static function unexpectedStatus(int $statusCode, string $context): self
    {
        return new self(sprintf(
            'Google Drive API returned an unexpected HTTP %d while %s.',
            $statusCode,
            $context,
        ));
    }

    public static function malformedResponse(string $context): self
    {
        return new self(sprintf(
            'Google Drive API returned an unreadable response while %s.',
            $context,
        ));
    }
}

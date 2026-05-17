<?php

declare(strict_types=1);

namespace GuideMap\Drive;

use DateTimeImmutable;

/**
 * Metadata for one file in Google Drive, as returned by the Drive v3 files
 * list endpoint. The bytes are fetched separately with
 * {@see DriveClient::downloadFile()}.
 */
final readonly class DriveFile
{
    public function __construct(
        public string $id,
        public string $name,
        public string $mimeType,
        public DateTimeImmutable $modifiedTime,
        public int $size,
    ) {
    }
}

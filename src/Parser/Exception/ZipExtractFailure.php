<?php

declare(strict_types=1);

namespace GuideMap\Parser\Exception;

/**
 * A `.zip` input could not be opened or extracted.
 */
final class ZipExtractFailure extends ParserException
{
    public static function cannotOpen(string $path, int $zipErrorCode): self
    {
        return new self(sprintf(
            'Could not open zip archive "%s" (ZipArchive error code %d).',
            $path,
            $zipErrorCode,
        ));
    }

    public static function cannotExtract(string $path): self
    {
        return new self(sprintf('Could not extract zip archive "%s".', $path));
    }
}

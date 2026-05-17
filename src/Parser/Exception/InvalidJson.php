<?php

declare(strict_types=1);

namespace GuideMap\Parser\Exception;

/**
 * A file expected to contain JSON could not be decoded.
 *
 * When raised for one file inside a multi-file zip, {@see \GuideMap\Parser\TakeoutParser}
 * catches it and records the message as a per-file error rather than letting
 * it abort the whole import.
 */
final class InvalidJson extends ParserException
{
    public static function inFile(string $path, string $reason): self
    {
        return new self(sprintf('Invalid JSON in "%s": %s', $path, $reason));
    }
}

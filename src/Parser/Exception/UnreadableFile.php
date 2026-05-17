<?php

declare(strict_types=1);

namespace GuideMap\Parser\Exception;

/**
 * The input path given to the parser does not exist or cannot be read.
 */
final class UnreadableFile extends ParserException
{
    public static function atPath(string $path): self
    {
        return new self(sprintf('Input file is missing or unreadable: %s', $path));
    }
}

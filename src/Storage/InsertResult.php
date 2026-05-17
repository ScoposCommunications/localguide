<?php

declare(strict_types=1);

namespace GuideMap\Storage;

/**
 * The outcome of an {@see ContributionRepository::insertMany()} call.
 *
 * `attempted` always equals `inserted + duplicates`: every contribution
 * handed in was either newly stored or recognized as an existing row by its
 * dedup hash.
 */
final readonly class InsertResult
{
    public function __construct(
        public int $inserted,
        public int $duplicates,
        public int $attempted,
    ) {
    }
}

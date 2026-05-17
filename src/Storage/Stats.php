<?php

declare(strict_types=1);

namespace GuideMap\Storage;

use DateTimeImmutable;
use GuideMap\ContributionType;

/**
 * Aggregate figures across every stored contribution, produced by
 * {@see ContributionRepository::stats()}.
 *
 * `averageRating` and the date bounds are nullable: an empty store has no
 * dates, and a store with no reviews has no ratings to average.
 */
final readonly class Stats
{
    /**
     * @param array<string, int> $byType count of rows per ContributionType
     *                                    backing value
     */
    public function __construct(
        public int $total,
        public array $byType,
        public ?float $averageRating,
        public ?DateTimeImmutable $earliestDate,
        public ?DateTimeImmutable $latestDate,
    ) {
    }

    /**
     * Count of stored contributions of one type (0 when none).
     */
    public function countOf(ContributionType|string $type): int
    {
        $key = $type instanceof ContributionType ? $type->value : $type;

        return $this->byType[$key] ?? 0;
    }
}

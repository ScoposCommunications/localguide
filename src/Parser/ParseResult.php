<?php

declare(strict_types=1);

namespace GuideMap\Parser;

use GuideMap\Contribution;

/**
 * The outcome of parsing a Takeout input.
 *
 * Holds every successfully parsed contribution, any non-fatal per-file error
 * messages, and a count of files that decoded and routed successfully.
 */
final readonly class ParseResult
{
    /**
     * @param list<Contribution> $contributions
     * @param list<string>       $errors
     */
    public function __construct(
        public array $contributions,
        public array $errors,
        public int $filesProcessed,
    ) {
    }

    public function contributionCount(): int
    {
        return count($this->contributions);
    }

    public function hasErrors(): bool
    {
        return $this->errors !== [];
    }

    /**
     * Count of parsed contributions grouped by type backing-value, e.g.
     * `['review' => 832, 'photo' => 298]`. Types with no contributions are
     * omitted.
     *
     * @return array<string, int>
     */
    public function countsByType(): array
    {
        $counts = [];
        foreach ($this->contributions as $contribution) {
            $key = $contribution->type->value;
            $counts[$key] = ($counts[$key] ?? 0) + 1;
        }

        return $counts;
    }
}

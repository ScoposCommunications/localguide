<?php

declare(strict_types=1);

namespace GuideMap\Parser;

use GuideMap\Contribution;

/**
 * The outcome of running one type parser over a decoded Takeout file.
 *
 * Holds the contributions produced, plus any per-record problems that caused
 * a record to be skipped (currently: a record with no parseable date — see
 * DECISIONS.md D14). {@see TakeoutParser} merges these into the file-level
 * {@see ParseResult}.
 */
final readonly class TypeParseResult
{
    /**
     * @param list<Contribution> $contributions
     * @param list<string>       $errors
     */
    public function __construct(
        public array $contributions,
        public array $errors,
    ) {
    }
}

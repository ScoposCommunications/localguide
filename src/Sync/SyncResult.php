<?php

declare(strict_types=1);

namespace GuideMap\Sync;

use DateTimeImmutable;

/**
 * The outcome of one {@see SyncOrchestrator::run()}.
 *
 * Counts:
 *  - `filesScanned`          — files the Drive folder listing returned;
 *  - `filesProcessed`        — new files downloaded, parsed and stored OK;
 *  - `contributionsInserted` — rows actually added to the repository;
 *  - `contributionsSkipped`  — parsed contributions that were duplicates of
 *                              rows already stored (dedup by hash, D4);
 *  - `errors`                — per-file failures and per-record parse notes,
 *                              each prefixed with the file it came from;
 *  - `syncedAt`              — when the run finished (DECISIONS.md D21).
 *
 * Files that were skipped because they had already been processed are simply
 * `filesScanned - filesProcessed - (failed files)`.
 */
final readonly class SyncResult
{
    /**
     * @param list<string> $errors
     */
    public function __construct(
        public int $filesScanned,
        public int $filesProcessed,
        public int $contributionsInserted,
        public int $contributionsSkipped,
        public array $errors,
        public DateTimeImmutable $syncedAt,
    ) {
    }

    public function hasErrors(): bool
    {
        return $this->errors !== [];
    }
}

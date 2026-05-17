<?php

declare(strict_types=1);

namespace GuideMap\Sync;

/**
 * Remembers which Drive files have already been imported, so a repeated sync
 * does not download and re-parse them.
 *
 * Keyed by Drive file id (DECISIONS.md D19). {@see InMemoryProcessedFilesStore}
 * backs dev and tests; the WordPress adapter will add a `$wpdb`/options-backed
 * implementation of this same interface.
 */
interface ProcessedFilesStore
{
    /**
     * Whether the given Drive file id has already been processed.
     */
    public function has(string $fileId): bool;

    /**
     * Record a Drive file id as processed.
     */
    public function markProcessed(string $fileId): void;

    /**
     * Every processed Drive file id recorded so far.
     *
     * @return list<string>
     */
    public function all(): array;
}

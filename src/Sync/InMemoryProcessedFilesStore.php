<?php

declare(strict_types=1);

namespace GuideMap\Sync;

/**
 * A {@see ProcessedFilesStore} that keeps its record in memory for the
 * lifetime of the process. Used by tests and the CLI sync simulator.
 */
final class InMemoryProcessedFilesStore implements ProcessedFilesStore
{
    /** @var array<string, true> processed file ids, used as a set */
    private array $processed = [];

    public function has(string $fileId): bool
    {
        return isset($this->processed[$fileId]);
    }

    public function markProcessed(string $fileId): void
    {
        $this->processed[$fileId] = true;
    }

    public function all(): array
    {
        return array_keys($this->processed);
    }
}

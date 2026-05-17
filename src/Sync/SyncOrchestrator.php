<?php

declare(strict_types=1);

namespace GuideMap\Sync;

use GuideMap\Clock\Clock;
use GuideMap\Drive\DriveClient;
use GuideMap\Parser\TakeoutParser;
use GuideMap\Storage\ContributionRepository;
use Throwable;

/**
 * Drives the end-to-end import: list a Drive folder, and for every Takeout
 * export not yet seen, download it, parse it, and store its contributions.
 *
 * This is the "brain" of the automation, and it is deliberately framework-free
 * — every collaborator is an interface or an already-tested class, so the
 * whole flow runs under PHPUnit (and the Phase 13 CLI simulator) with no
 * network, no WordPress, and no Google credentials.
 *
 * Resilience: each file is handled in isolation. A download failure, a corrupt
 * zip, or a storage error is recorded against that file and the sync moves on
 * to the next one; one bad file never aborts the run. A file is marked
 * processed only after it has been stored successfully, so a failed file is
 * retried on the next sync.
 */
final class SyncOrchestrator
{
    public function __construct(
        private readonly DriveClient $driveClient,
        private readonly TakeoutParser $parser,
        private readonly ContributionRepository $repository,
        private readonly ProcessedFilesStore $processedFiles,
        private readonly Clock $clock,
    ) {
    }

    /**
     * Sync every not-yet-processed Takeout export in a Drive folder.
     */
    public function run(string $folderId): SyncResult
    {
        $files = $this->driveClient->listFolderFiles($folderId);

        $filesProcessed = 0;
        $inserted = 0;
        $skipped = 0;
        $errors = [];

        foreach ($files as $file) {
            if ($this->processedFiles->has($file->id)) {
                continue;
            }

            $tempPath = sys_get_temp_dir() . '/guidemap-sync-' . uniqid('', true) . '.zip';
            try {
                $this->driveClient->downloadFile($file->id, $tempPath);
                $parseResult = $this->parser->parse($tempPath);
                $insertResult = $this->repository->insertMany($parseResult->contributions);

                $inserted += $insertResult->inserted;
                $skipped += $insertResult->duplicates;
                foreach ($parseResult->errors as $error) {
                    $errors[] = $file->name . ': ' . $error;
                }

                // Marked only now — a failure above leaves the file unmarked
                // so the next sync retries it.
                $this->processedFiles->markProcessed($file->id);
                $filesProcessed++;
            } catch (Throwable $exception) {
                $errors[] = $file->name . ': ' . $exception->getMessage();
            } finally {
                if (is_file($tempPath)) {
                    @unlink($tempPath);
                }
            }
        }

        return new SyncResult(
            filesScanned: count($files),
            filesProcessed: $filesProcessed,
            contributionsInserted: $inserted,
            contributionsSkipped: $skipped,
            errors: $errors,
            syncedAt: $this->clock->now(),
        );
    }
}

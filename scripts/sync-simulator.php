<?php

declare(strict_types=1);

/**
 * CLI sync simulator for the GuideMap Pro core library.
 *
 * Runs the *real* SyncOrchestrator end-to-end — Drive listing, download,
 * parse, store, dedup — against an in-process fake Google Drive. There is no
 * network, no OAuth, and no Google credentials: the "Drive folder" is three
 * mock files, each served the bundled fixtures/takeout-sample.zip.
 *
 * This is the smoke test to validate Phases 10-12 before any real Google
 * credentials exist.
 *
 *   php scripts/sync-simulator.php
 */

use GuideMap\Clock\SystemClock;
use GuideMap\Drive\DriveClient;
use GuideMap\Http\FakeHttpClient;
use GuideMap\Http\HttpResponse;
use GuideMap\OAuth\StaticTokenProvider;
use GuideMap\Parser\TakeoutParser;
use GuideMap\Storage\SqliteContributionRepository;
use GuideMap\Sync\InMemoryProcessedFilesStore;
use GuideMap\Sync\SyncOrchestrator;
use GuideMap\Sync\SyncResult;

require_once dirname(__DIR__) . '/vendor/autoload.php';

const DATABASE_PATH = '/tmp/guidemap-sync-sim.sqlite';
const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';

$tick = "\u{2713}";

$sampleZip = dirname(__DIR__) . '/fixtures/takeout-sample.zip';
if (!is_file($sampleZip)) {
    fwrite(STDERR, "Missing fixture: {$sampleZip}\n");
    fwrite(STDERR, "Run: php scripts/build-sample-zip.php\n");
    exit(1);
}
$zipBytes = (string) file_get_contents($sampleZip);

// --- Build a fake Google Drive: one folder of three Takeout exports. -------
$mockFiles = [];
foreach (['20260101', '20260201', '20260301'] as $index => $stamp) {
    $mockFiles[] = [
        'id' => 'sample-file-' . ($index + 1),
        'name' => 'takeout-' . $stamp . '.zip',
        'mimeType' => 'application/zip',
        'modifiedTime' => substr($stamp, 0, 4) . '-' . substr($stamp, 4, 2) . '-'
            . substr($stamp, 6, 2) . 'T00:00:00.000Z',
        'size' => strlen($zipBytes),
    ];
}

$cannedResponses = [
    'GET ' . DRIVE_FILES_ENDPOINT => new HttpResponse(
        200,
        [],
        (string) json_encode(['files' => $mockFiles], JSON_THROW_ON_ERROR),
    ),
];
foreach ($mockFiles as $file) {
    $cannedResponses['GET ' . DRIVE_FILES_ENDPOINT . '/' . $file['id']]
        = new HttpResponse(200, [], $zipBytes);
}

$http = new FakeHttpClient($cannedResponses);

// --- Wire the orchestrator with the fake stack. ----------------------------
if (is_file(DATABASE_PATH)) {
    unlink(DATABASE_PATH);
}
$repository = SqliteContributionRepository::fromFile(DATABASE_PATH);

$orchestrator = new SyncOrchestrator(
    new DriveClient(new StaticTokenProvider(), $http),
    new TakeoutParser(),
    $repository,
    new InMemoryProcessedFilesStore(),
    new SystemClock(),
);

$printResult = static function (string $heading, SyncResult $result) use ($tick): void {
    echo "  " . $heading . "\n";
    printf(
        "    %s Scanned %d file%s, processed %d new\n",
        $tick,
        $result->filesScanned,
        $result->filesScanned === 1 ? '' : 's',
        $result->filesProcessed,
    );
    printf(
        "    %s Contributions: %s inserted, %s skipped as duplicates\n",
        $tick,
        number_format($result->contributionsInserted),
        number_format($result->contributionsSkipped),
    );
    printf("    %s Synced at %s UTC\n", $tick, $result->syncedAt->format('Y-m-d H:i:s'));
    foreach ($result->errors as $error) {
        echo "    ! " . $error . "\n";
    }
};

// --- Run twice: a fresh sync, then an idempotent re-sync. ------------------
echo "\nGuideMap Pro - sync simulator\n";
echo "Running the real SyncOrchestrator against an in-process fake Google Drive.\n";
echo "(No network, no credentials: the folder is 3 copies of takeout-sample.zip.)\n\n";

$printResult('Run 1 - fresh sync', $orchestrator->run('simulated-folder-id'));
echo "\n";
$printResult('Run 2 - re-sync (every file already processed)', $orchestrator->run('simulated-folder-id'));

echo "\n  Database written to " . DATABASE_PATH . ' (' . $repository->count() . " rows)\n";
echo "  HTTP requests made to the fake Drive: " . $http->requestCount() . "\n\n";

exit(0);

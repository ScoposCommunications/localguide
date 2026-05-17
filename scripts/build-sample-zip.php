<?php

declare(strict_types=1);

/**
 * Regenerates fixtures/takeout-sample.zip from the JSON fixtures, nesting them
 * the way a real Google Takeout "Maps" export lays its files out.
 *
 * The resulting zip is what the CLI smoke test consumes:
 *   php scripts/parse-takeout.php fixtures/takeout-sample.zip
 *
 * Re-run this after editing any fixture:
 *   php scripts/build-sample-zip.php
 */

$root = dirname(__DIR__);
$fixturesDir = $root . '/fixtures';
$target = $fixturesDir . '/takeout-sample.zip';

/** Fixture file => path inside the zip. */
$layout = [
    'reviews.json' => 'Takeout/Maps (your places)/Reviews.json',
    'starred.json' => 'Takeout/Maps (your places)/Starred places.json',
    'photos.json' => 'Takeout/Google Photos/Photos contributed to Maps.json',
    'questions.json' => 'Takeout/Maps (your places)/Questions.json',
];

$zip = new ZipArchive();
if ($zip->open($target, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
    fwrite(STDERR, "Could not create {$target}\n");
    exit(1);
}

foreach ($layout as $fixture => $entryName) {
    $path = $fixturesDir . '/' . $fixture;
    if (!is_file($path)) {
        fwrite(STDERR, "Missing fixture: {$path}\n");
        exit(1);
    }
    $zip->addFile($path, $entryName);
}

$zip->close();

printf("Wrote %s (%d bytes, %d entries)\n", $target, (int) filesize($target), count($layout));

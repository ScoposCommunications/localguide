<?php

declare(strict_types=1);

/**
 * CLI smoke test for the GuideMap Pro core library.
 *
 * Runs a Google Takeout export through the parser, stores the result in a
 * fresh SQLite database, and prints a human-readable summary. This is the
 * script to point at a real Takeout export to validate the library:
 *
 *   php scripts/parse-takeout.php path/to/takeout.zip
 *
 * Or try the bundled sample, which needs no real data:
 *
 *   php scripts/parse-takeout.php fixtures/takeout-sample.zip
 *
 * It accepts a `.zip` (a full Takeout export) or a single `.json`/`.geojson`
 * file. The SQLite database is rewritten from scratch on every run so the
 * reported counts are always reproducible.
 */

use GuideMap\ContributionType;
use GuideMap\Parser\Exception\ParserException;
use GuideMap\Parser\TakeoutParser;
use GuideMap\Storage\SqliteContributionRepository;

require_once dirname(__DIR__) . '/vendor/autoload.php';

const EXIT_OK = 0;
const EXIT_USAGE = 1;
const EXIT_FAILURE = 2;

const DATABASE_PATH = '/tmp/guidemap-test.sqlite';

$inputPath = $argv[1] ?? null;
if ($inputPath === null || in_array($inputPath, ['-h', '--help'], true)) {
    fwrite(STDERR, "Usage:  php scripts/parse-takeout.php <path-to-takeout.zip>\n");
    fwrite(STDERR, "Sample: php scripts/parse-takeout.php fixtures/takeout-sample.zip\n");
    exit($inputPath === null ? EXIT_USAGE : EXIT_OK);
}

// Begin from a clean database every run so counts stay reproducible.
if (is_file(DATABASE_PATH)) {
    unlink(DATABASE_PATH);
}

try {
    $result = (new TakeoutParser())->parse($inputPath);
} catch (ParserException $exception) {
    fwrite(STDERR, sprintf("\n  \u{2717} Could not parse \"%s\": %s\n\n", $inputPath, $exception->getMessage()));
    exit(EXIT_FAILURE);
}

$repository = SqliteContributionRepository::fromFile(DATABASE_PATH);
$insert = $repository->insertMany($result->contributions);
$stats = $repository->stats();

$format = static fn (int $value): string => number_format($value);
$plural = static fn (int $value): string => $value === 1 ? '' : 's';

echo "\n";

printf(
    "  \u{2713} Parsed %s contributions from %s file%s\n",
    $format($result->contributionCount()),
    $format($result->filesProcessed),
    $plural($result->filesProcessed),
);

$countsByType = $result->countsByType();
foreach (ContributionType::cases() as $type) {
    $count = $countsByType[$type->value] ?? 0;
    if ($count > 0) {
        printf("    - %s %s\n", $format($count), $type->label());
    }
}

printf(
    "  \u{2713} Inserted %s row%s (%s duplicate%s)\n",
    $format($insert->inserted),
    $plural($insert->inserted),
    $format($insert->duplicates),
    $plural($insert->duplicates),
);

printf(
    "  \u{2713} Stats: avg rating %s, earliest %s, latest %s\n",
    $stats->averageRating !== null ? number_format($stats->averageRating, 1) : 'n/a',
    $stats->earliestDate?->format('Y-m-d') ?? 'n/a',
    $stats->latestDate?->format('Y-m-d') ?? 'n/a',
);

if ($result->hasErrors()) {
    printf("  ! %d file-level note%s:\n", count($result->errors), $plural(count($result->errors)));
    foreach ($result->errors as $error) {
        echo '      - ' . $error . "\n";
    }
}

echo '  Database written to ' . DATABASE_PATH . "\n\n";

exit(EXIT_OK);

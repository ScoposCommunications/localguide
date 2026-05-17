# GuideMap Pro

GuideMap Pro turns a Google Takeout "Maps" export into a clean, deduplicated,
queryable store of a person's map contributions — their reviews, photos,
starred places, and questions. This repository contains the **core library**:
framework-free PHP that parses the (notoriously inconsistent) Takeout JSON,
normalizes it, persists it, and can pull exports automatically from Google
Drive. It is the foundation a WordPress plugin will later be built on top of,
with only a thin integration layer added — no rewrites of the parsing,
storage, or sync logic.

## Current state

**Core PHP library — no WordPress integration yet.**

What exists today, all framework-free under `src/`:

- A tolerant **parser** (`GuideMap\Parser\TakeoutParser`) that accepts a
  Takeout `.zip` or a single `.json`/`.geojson` file, copes with every Takeout
  field-name variant we have seen, and returns normalized value objects.
- A **storage layer** (`GuideMap\Storage\ContributionRepository`) with a
  SQLite implementation for local development, plus a MySQL-compatible schema
  ready for production.
- An **automation layer** that fetches exports straight from Google Drive:
  OAuth token refresh (`GoogleTokenProvider`), a Drive v3 client
  (`DriveClient`), and a `SyncOrchestrator` that lists a Drive folder,
  downloads each new export, parses it, and stores it. HTTP and time sit
  behind interfaces, so the whole flow is tested with no network.
- A PHPUnit suite of 200+ tests and two command-line smoke tests.

What does **not** exist yet (by design): the WordPress plugin, its admin
screens, shortcodes/blocks, the `$wpdb`-backed repository, and the OAuth
*callback* that first acquires a refresh token. See the roadmap below.

## Roadmap

The two-layer design (framework-free core + thin WordPress adapter), the
component diagram, the data flow, and the explicitly-open questions are all
documented in **[ARCHITECTURE.md](ARCHITECTURE.md)**. The reasoning behind the
concrete technical choices is in **[DECISIONS.md](DECISIONS.md)**.

Next milestones, in order:

1. `WpdbContributionRepository` — the same `ContributionRepository` interface,
   backed by WordPress's `$wpdb` and the MySQL schema; plus `$wpdb`/options
   implementations of `TokenCache` and `ProcessedFilesStore`.
2. WordPress plugin shell — activation hook (creates the table), the OAuth
   consent/callback endpoint, a WP-Cron trigger for `SyncOrchestrator`, an
   admin uploader for manual imports, capability/nonce checks.
3. Front-end rendering — shortcodes/blocks for a map and a contribution grid.

## Requirements

- PHP 8.2 or newer
- PHP extensions: `json`, `mbstring`, `pdo`, `pdo_sqlite`, `zip`
- [Composer](https://getcomposer.org/) (development only)

## Running the tests

```bash
composer install && vendor/bin/phpunit
```

The suite runs entirely against in-memory SQLite — no database server, no web
server, no WordPress.

## Testing against a real Takeout export

Point the CLI smoke test at a Google Takeout "Maps" export:

```bash
php scripts/parse-takeout.php path/to/takeout.zip
```

It parses the export, stores it in a fresh SQLite database at
`/tmp/guidemap-test.sqlite`, and prints a summary:

```
  ✓ Parsed 1,247 contributions from 4 files
    - 832 reviews
    - 298 photos
    - 89 starred places
    - 28 questions
  ✓ Inserted 1,247 rows (0 duplicates)
  ✓ Stats: avg rating 4.3, earliest 2016-04-12, latest 2026-05-10
  Database written to /tmp/guidemap-test.sqlite
```

No real export handy? A bundled sample needs no personal data:

```bash
php scripts/parse-takeout.php fixtures/takeout-sample.zip
```

## Simulating a Google Drive sync

The Drive sync runs end to end with no network and no credentials — against an
in-process fake Drive that serves the bundled sample export:

```bash
php scripts/sync-simulator.php
```

It runs the real `SyncOrchestrator` twice — a fresh sync, then an idempotent
re-sync — and prints the `SyncResult` of each, proving the OAuth → Drive →
parse → store → dedup pipeline without any Google account.

## Project layout

```
src/         Framework-free core library (PSR-4: GuideMap\)
               Parser/ Storage/ Http/ Clock/ OAuth/ Drive/ Sync/
tests/       PHPUnit test suite, mirroring src/
fixtures/    Realistic sample Takeout JSON + a sample export zip
scripts/     CLI smoke tests (parse-takeout.php, sync-simulator.php)
               and the sample-zip builder (build-sample-zip.php)
docs/        Supplementary reference documentation
_archive/    The previous React/Vercel scraper, kept for reference only
```

## How to obtain a Google Takeout Maps export

At [takeout.google.com](https://takeout.google.com), deselect everything,
select **Maps** and **Maps (your places)** (and **Google Photos** if you want
photo contributions), then export. The resulting `.zip` is what
`parse-takeout.php` consumes.

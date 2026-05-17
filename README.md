# GuideMap Pro

GuideMap Pro turns a Google Takeout "Maps" export into a clean, deduplicated,
queryable store of a person's map contributions — their reviews, photos,
starred places, and questions. This repository contains the **core library**:
framework-free PHP that parses the (notoriously inconsistent) Takeout JSON,
normalizes it, and persists it. It is the foundation a WordPress plugin will
later be built on top of, with only a thin integration layer added — no
rewrites of the parsing or storage logic.

## Current state

**Core PHP library — no WordPress integration yet.**

What exists today:

- A tolerant parser (`GuideMap\Parser\TakeoutParser`) that accepts a Takeout
  `.zip` or a single `.json`/`.geojson` file, copes with every Takeout
  field-name variant we have seen, and returns normalized value objects.
- A storage layer (`GuideMap\Storage\ContributionRepository`) with a
  SQLite implementation for local development, plus a MySQL-compatible schema
  ready for production.
- A full PHPUnit test suite and a command-line smoke test.

What does **not** exist yet (by design): the WordPress plugin, its admin
screens, shortcodes/blocks, the `$wpdb`-backed repository, and any OAuth or
upload handling. See the roadmap below.

## Roadmap

The two-layer design (framework-free core + thin WordPress adapter), the
component diagram, the data flow, and the explicitly-open questions are all
documented in **[ARCHITECTURE.md](ARCHITECTURE.md)**. The reasoning behind the
concrete technical choices is in **[DECISIONS.md](DECISIONS.md)**.

Next milestones, in order:

1. `WpdbContributionRepository` — the same `ContributionRepository` interface,
   backed by WordPress's `$wpdb` and the MySQL schema.
2. WordPress plugin shell — activation hook (creates the table), an admin
   uploader for the Takeout export, capability/nonce checks.
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

## Project layout

```
src/         Framework-free core library (PSR-4: GuideMap\)
tests/       PHPUnit test suite
fixtures/    Realistic sample Takeout JSON + a sample export zip
scripts/     CLI smoke test (parse-takeout.php) and the sample-zip builder
docs/        Supplementary reference documentation
_archive/    The previous React/Vercel scraper, kept for reference only
```

## How to obtain a Google Takeout Maps export

At [takeout.google.com](https://takeout.google.com), deselect everything,
select **Maps** and **Maps (your places)** (and **Google Photos** if you want
photo contributions), then export. The resulting `.zip` is what
`parse-takeout.php` consumes.

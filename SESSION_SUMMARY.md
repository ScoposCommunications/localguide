# Session Summary — GuideMap Pro foundation

This session pivoted the repository from a React/Vercel Google Maps profile
scraper to **GuideMap Pro**, and built the framework-free PHP foundation: a
Google Takeout parser and a storage layer, both fully testable from the command
line with no WordPress and no infrastructure.

**Status: all seven phases complete. 139 tests pass. No WordPress work started.**

---

## What was done, by phase

1. **Clean slate.** The entire previous React app was moved into `_archive/`
   (nothing deleted) and a fresh PHP project structure created.
2. **Documentation first.** `ARCHITECTURE.md` and `DECISIONS.md` written before
   the code.
3. **Core domain.** Framework-free value objects, four Takeout type parsers, a
   zip-aware entry point, and tolerant field/date/coordinate helpers.
4. **Storage layer.** A repository interface, a SQLite implementation, and a
   schema written in both SQLite and MySQL dialects.
5. **Tests.** A PHPUnit suite covering parsing, storage, hashing, dedup, stats
   and filtering, plus realistic JSON fixtures.
6. **CLI smoke test.** `scripts/parse-takeout.php` parses an export and prints
   a summary.
7. **README.** Written with current state, roadmap, and run instructions.

---

## Files created

### Project root
- `composer.json` — PHP 8.2+, PSR-4 `GuideMap\` → `src/`, dev-dep PHPUnit 10.
- `composer.lock` — committed for reproducible dev installs.
- `phpunit.xml` — test suite config; `src/` registered as the coverage source.
- `.gitignore` — ignores `vendor/`, the PHPUnit cache, and `*.sqlite`.
- `README.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `SESSION_SUMMARY.md`.

### `src/` — core library (20 files)
- `Contribution.php` — immutable value object; `create()` factory rounds
  coordinates and derives the dedup hash.
- `ContributionType.php` — enum `Review | Photo | Starred | Question`.
- `Parser/TakeoutParser.php` — entry point: zip extraction, file routing, type
  detection, JSON decoding, cleanup.
- `Parser/ReviewsParser.php`, `StarredParser.php`, `PhotosParser.php`,
  `QuestionsParser.php` — one Takeout file type each.
- `Parser/PropertyFinder.php` — case-insensitive, dot-notation field lookup.
- `Parser/Coordinates.php` — coordinate resolution (centralizes the GeoJSON
  `[lng, lat]` ordering rule).
- `Parser/DateParser.php` — tolerant date/timestamp normalization to UTC.
- `Parser/ParseResult.php` — readonly result `{ contributions, errors,
  filesProcessed }`.
- `Parser/Exception/ParserException.php` (base), `UnreadableFile.php`,
  `ZipExtractFailure.php`, `InvalidJson.php`.
- `Storage/Schema.php` — single source of truth for the table; SQLite + MySQL
  DDL.
- `Storage/ContributionRepository.php` — storage interface.
- `Storage/SqliteContributionRepository.php` — PDO/SQLite implementation.
- `Storage/InsertResult.php`, `Storage/Stats.php` — readonly value objects.

### `fixtures/` — sample data (5 files)
- `reviews.json`, `starred.json`, `photos.json`, `questions.json` — realistic
  Takeout JSON exercising every field-name variant.
- `takeout-sample.zip` — the four fixtures bundled in a Takeout-style layout
  (regenerable via `scripts/build-sample-zip.php`).

### `scripts/` (2 files)
- `parse-takeout.php` — the CLI smoke test.
- `build-sample-zip.php` — rebuilds `fixtures/takeout-sample.zip`.

### `docs/`
- `takeout-formats.md` — reference for the Takeout field-name variants and
  fixture shapes.

---

## Tests written (14 files, 139 tests, 367 assertions — all passing)

- `tests/TestCase.php` — shared base (project paths, fixture loading).
- `tests/ContributionTest.php` — coordinate rounding; hash stability; the
  per-type hash formula; type/url/date sensitivity; first-50-chars rule for
  questions; Null Island detection.
- `tests/ContributionTypeTest.php` — backing values, reconstruction, labels.
- `tests/Parser/PropertyFinderTest.php` — exact/case-insensitive/dot-notation
  lookup; first-match and null-fallthrough; string/float/int coercion.
- `tests/Parser/DateParserTest.php` — ISO-8601, offsets, bare dates, second-
  and millisecond timestamps, epoch fallbacks.
- `tests/Parser/CoordinatesTest.php` — GeoJSON `[lng, lat]` order, flat/nested
  keys, `geoDataExif`, Null Island, precedence.
- `tests/Parser/ReviewsParserTest.php` — every rating/text/date/name variant
  (data-provided); proof that variant spellings yield an identical
  `Contribution`; 0,0 skipping; all input shapes; fixture parse.
- `tests/Parser/StarredParserTest.php` — no rating/text; nested vs. flat names;
  case-insensitive fields; 0,0 skipping; fixture parse.
- `tests/Parser/PhotosParserTest.php` — title→place name; view-count and date
  variants; `geoDataExif`→`geoData` fallback; 0,0 skipping; fixture parse.
- `tests/Parser/QuestionsParserTest.php` — text/url variants; question text
  stored in `reviewText`; nested/flat coordinates; 0,0 skipping; fixture parse.
- `tests/Parser/TakeoutParserTest.php` — sample-zip parse; single-file parse;
  structure-based detection; `.geojson` support; per-file error collection;
  unrecognized-file and empty-zip handling; `UnreadableFile` /
  `ZipExtractFailure` exceptions; temp-directory cleanup.
- `tests/Storage/SchemaTest.php` — table name; both DDL dialects; statement
  splitting; the SQLite schema applied to a live database.
- `tests/Storage/SqliteContributionRepositoryTest.php` — insert; dedup across
  calls and within a batch; `find`; full round-trip for reviews and photos;
  newest-first ordering; filter by type / date range / search (incl. LIKE
  wildcard escaping); limit/offset; stats (counts, average, date bounds, empty
  store); `types()`; `truncate()` and sequence reset; on-disk persistence.
- `tests/Cli/ParseTakeoutScriptTest.php` — runs `parse-takeout.php` as a
  subprocess: summary output, usage message, graceful failure.

### Coverage note

No coverage driver (Xdebug or PCOV) is installed in this environment, so line
coverage could not be machine-measured against the >80% target. The suite is
written to exercise every class, every public method, and every documented
branch in `src/Parser` and `src/Storage`; a run with a coverage driver would
confirm the figure.

---

## Decisions recorded

All in `DECISIONS.md` (D1–D13). In brief:

- **D1** Repository pattern over Active Record — lets SQLite be swapped for
  `$wpdb`.
- **D2** SQLite for local dev — zero setup, mirrors the MySQL schema.
- **D3** Composer + PSR-4 for dev, even though the plugin will not ship
  Composer.
- **D4** SHA-256 per-type dedup hash; the hashed fields chosen for stability.
- **D5** One `Schema` class holding both SQLite and MySQL DDL.
- **D6** Coordinates rounded to 7 decimal places (~11 mm).
- **D7** PHP 8.2 minimum — the brief said "8.0+", but enums need 8.1 and
  `readonly` classes need 8.2, and 8.1 is end-of-life as of 2026-01.
- **D8** Value objects are `final readonly class`.
- **D9** Old React app moved to `_archive/`; this deactivates its old GitHub
  Actions workflows, which is intended.
- **D10** Sub-parsers consume decoded arrays; `TakeoutParser` owns all I/O.
- **D11** Throw for fatal whole-input errors; collect per-file errors as data.
- **D12** Missing dates default to the Unix epoch (a non-nullable `date`).
- **D13** `.geojson` accepted everywhere `.json` is.

---

## Verification performed

- `vendor/bin/phpunit` — **139 tests, 367 assertions, all passing.**
- `php -l` — clean on every file in `src/`, `tests/`, and `scripts/`.
- `php scripts/parse-takeout.php fixtures/takeout-sample.zip` — parses 16
  contributions from 4 files and writes the SQLite database as expected.

---

## Where I left off

The framework-free foundation is **complete and verified**. Per the brief, I
**stopped here** and did not begin the WordPress integration or any OAuth work
— that is waiting for your review.

When you are ready to continue, the **exact next step** is:

> Create `src/Storage/WpdbContributionRepository.php` — a second implementation
> of the existing `ContributionRepository` interface, backed by WordPress's
> `$wpdb`. It should reuse `Schema::mysql()` for table creation (substituting
> `$wpdb->prefix` for the table name and `$wpdb->get_charset_collate()` for the
> trailing ENGINE/CHARSET clause), and translate `INSERT OR IGNORE` to MySQL's
> `INSERT IGNORE`. The `SqliteContributionRepositoryTest` is the behavioral
> contract the new class must satisfy.

After that: the WordPress plugin shell (activation hook, admin uploader with
capability/nonce checks), then front-end rendering. The open questions to
resolve with product input before or during that work are listed at the end of
`ARCHITECTURE.md`.

To get oriented in a fresh session: read `ARCHITECTURE.md`, then run
`composer install && vendor/bin/phpunit`.

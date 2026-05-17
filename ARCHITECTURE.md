# GuideMap Pro — Architecture

GuideMap Pro turns a Google Takeout "Maps" export into a queryable store of a
person's map contributions (reviews, photos, starred places, questions). This
document describes the architecture of the **core library** that lives in this
repository today, and how the planned **WordPress plugin** will sit on top of
it later.

---

## 1. Two-layer design

The project is deliberately split into two layers so that the hard, bug-prone
work (parsing inconsistent Takeout JSON, deduplicating, storing) never depends
on WordPress.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 2 — WordPress adapter            (LATER, not in repo) │
│  • Plugin bootstrap, activation hook, admin screens          │
│  • Shortcodes / blocks that render contributions             │
│  • WpdbContributionRepository  (implements the same          │
│    ContributionRepository interface, backed by $wpdb)        │
│  • Upload handling, nonce/capability checks                  │
└───────────────────────────────▲─────────────────────────────┘
                                 │  depends on
                                 │  (interfaces only)
┌───────────────────────────────┴─────────────────────────────┐
│  Layer 1 — Core library                 (THIS REPOSITORY)    │
│  • Framework-free PHP, PSR-4 autoloaded under GuideMap\       │
│  • Parser, domain value objects, Repository interface        │
│  • SqliteContributionRepository for local dev + tests        │
│  • Zero WordPress, zero global state                         │
└──────────────────────────────────────────────────────────────┘
```

The dependency arrow points **upward only**. Layer 1 knows nothing about
Layer 2. The WordPress plugin will `require` the `src/` tree (or a copy of it)
and add a thin integration shell — no rewrites of the parser or storage logic.

---

## 2. Component diagram

```
   Takeout export (.zip / .json / .geojson)
                 │
                 ▼
        ┌──────────────────┐
        │  TakeoutParser   │  extract zip, walk files, route by name/shape
        └──────────────────┘
                 │  decoded JSON arrays
                 ▼
        ┌──────────────────┐
        │  Type parsers    │  ReviewsParser · StarredParser ·
        │                  │  PhotosParser · QuestionsParser
        └──────────────────┘
                 │  uses
                 ▼
        ┌──────────────────┐
        │  PropertyFinder  │  case-insensitive, dot-path field lookup
        │  DateParser      │  tolerant date/timestamp normalization
        └──────────────────┘
                 │  normalized fields
                 ▼
        ┌──────────────────┐
        │  Contribution    │  readonly value object; computes its
        │  ::create()      │  own dedup hash on construction
        └──────────────────┘
                 │  Contribution[]  (wrapped in ParseResult)
                 ▼
        ┌──────────────────────────────┐
        │  ContributionRepository      │  interface
        │   └─ SqliteContributionRepo  │  PDO + SQLite (dev/tests)
        │   └─ WpdbContributionRepo    │  $wpdb (LATER — not built)
        └──────────────────────────────┘
                 │  stored rows
                 ▼
        ┌──────────────────────────────┐
        │  (LATER) WP shortcodes/blocks │  render map + grid
        └──────────────────────────────┘
```

"Normalizer" in the Parser → Normalizer → Repository pipeline is **not a single
class**. Normalization is performed cooperatively by `PropertyFinder` (resolves
the many Takeout field-name spellings to one value), `DateParser` (coerces
strings/timestamps to `DateTimeImmutable`), and each type parser (maps raw
fields onto the `Contribution` shape, rounds coordinates, drops junk rows). The
result of normalization is a fully-formed `Contribution` value object.

---

## 3. Data flow

End to end, a single export moves through these stages:

```
 Takeout ZIP
   │
   ├─▶ Extract        → unzip into sys_get_temp_dir()/guidemap-<uniqid>
   │                    (a bare .json/.geojson skips this stage)
   │
   ├─▶ Detect type    → route each file by filename keyword first
   │                    (reviews/starred/photos/questions), then fall
   │                    back to inspecting the JSON structure
   │
   ├─▶ Parse          → the matching type parser walks the records
   │
   ├─▶ Normalize      → PropertyFinder resolves field-name variants;
   │                    DateParser coerces dates; [lng,lat] GeoJSON
   │                    order is honored; lat/lng rounded to 7 places;
   │                    rows with lat==0 AND lng==0 are skipped
   │
   ├─▶ Hash           → Contribution::create() computes a SHA-256 over
   │                    the stable identifying fields for that type
   │
   ├─▶ Dedupe         → the hash column is UNIQUE; insertMany() uses
   │                    INSERT OR IGNORE so re-importing the same
   │                    export is a no-op (duplicates counted, not errors)
   │
   └─▶ Store          → rows land in the `contributions` table via the
                        repository; temp extraction dir is removed in a
                        finally block whether parsing succeeds or fails
```

Failures are handled at two levels:

- **Fatal, whole-input problems** (missing file, unreadable file, a zip that
  will not open) throw typed exceptions from `GuideMap\Parser\Exception\`.
- **Per-file problems** (one malformed JSON file inside an otherwise good zip,
  an unrecognized file shape) are collected as strings in `ParseResult::$errors`
  so one bad file never aborts the rest of the import.

---

## 4. Why this split

- **Testability.** The parser and repository run from the command line under
  PHPUnit with no WordPress, no MySQL, and no web server. A full parse → store
  → query cycle executes against an in-memory SQLite database in milliseconds.
- **No WordPress dependency for the hard parts.** The genuinely difficult code
  — coping with Takeout's inconsistent field names, GeoJSON coordinate order,
  date formats, and deduplication — is plain PHP. It can be reasoned about and
  fuzzed without booting a CMS.
- **Easy to port later.** The WordPress plugin only has to implement one
  interface (`ContributionRepository`) against `$wpdb`, register an uploader,
  and render output. The schema is written in generic SQL with a documented
  MySQL variant, so the dev SQLite database and the production MySQL table are
  column-for-column identical.
- **Swappable storage.** Because callers depend on the `ContributionRepository`
  interface rather than a concrete class, moving from SQLite to `$wpdb` is a
  constructor change, not a refactor.

---

## 5. Open questions for later

These are intentionally **left unresolved**. They need product input or a
WordPress environment to decide and should not be guessed at now.

- **[OPEN] WordPress data ownership.** One global contributions table, or
  per-user/per-author rows? Multisite behavior is undecided.
- **[OPEN] Plugin distribution & vendoring.** The shipped plugin will not run
  `composer install` on the host. Do we copy `src/` into the plugin, commit a
  pruned `vendor/`, or build a release artifact? (Dev tooling stays Composer —
  see DECISIONS.md.)
- **[OPEN] Re-import / sync semantics.** Today re-importing is idempotent via
  the hash. Should a later export that *removes* a contribution also remove the
  stored row, or is the store append-only?
- **[OPEN] Photo view counts over time.** `photo_views` is a point-in-time
  snapshot. Tracking history would need a separate table.
- **[OPEN] Authoritative Takeout schema.** Field-name variants here are handled
  defensively from observed exports. A real export from the product owner may
  reveal more spellings or a `questions`/`photos` shape we have not modeled.
- **[OPEN] Geocoding gaps.** Some contributions (notably questions) may lack
  coordinates. Whether to geocode them via an external API, or render them in a
  list-only view, is undecided.
- **[OPEN] Front-end rendering.** Map library, block vs. shortcode, and theme
  styling are all Layer 2 concerns not yet specified.

---

## 6. Directory map

```
src/
  Contribution.php             value object + hash factory
  ContributionType.php         enum: Review | Photo | Starred | Question
  Parser/
    TakeoutParser.php          entry point: zip/json → ParseResult
    ReviewsParser.php          one Takeout file type → Contribution[]
    StarredParser.php
    PhotosParser.php
    QuestionsParser.php
    PropertyFinder.php         tolerant field lookup
    DateParser.php             tolerant date normalization
    ParseResult.php            { contributions, errors, filesProcessed }
    Exception/                 typed parser exceptions
  Storage/
    Schema.php                 SQLite + MySQL DDL (one source of truth)
    ContributionRepository.php  storage interface
    SqliteContributionRepository.php  PDO/SQLite implementation
    InsertResult.php           { inserted, duplicates, attempted }
    Stats.php                  { total, byType, averageRating, dates }
tests/                         PHPUnit unit tests mirroring src/
fixtures/                      realistic sample Takeout JSON + sample zip
scripts/parse-takeout.php      CLI smoke test
docs/                          supplementary reference docs
```

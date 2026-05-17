# GuideMap Pro — Architecture

GuideMap Pro turns a Google Takeout "Maps" export into a queryable store of a
person's map contributions (reviews, photos, starred places, questions). This
document describes the architecture of the **core library** that lives in this
repository today, and how the planned **WordPress plugin** will sit on top of
it later.

---

## 1. Two-layer design

The project is deliberately split into two layers so that the hard, bug-prone
work — parsing inconsistent Takeout JSON, deduplicating, storing, and now
fetching exports from Google Drive — never depends on WordPress.

```
+----------------------------------------------------------------+
|  Layer 2 - WordPress adapter             (LATER, not in repo)   |
|  - Plugin bootstrap, activation hook, admin screens             |
|  - Shortcodes / blocks that render contributions                |
|  - WpdbContributionRepository (the ContributionRepository       |
|    interface, backed by $wpdb)                                  |
|  - OAuth redirect/callback endpoint; WP-Cron sync trigger       |
|  - $wpdb / options-backed TokenCache + ProcessedFilesStore      |
|  - Upload handling, nonce / capability checks                   |
+--------------------------------+-------------------------------+
                                 |  depends on
                                 |  (interfaces only)
+--------------------------------+-------------------------------+
|  Layer 1 - Core library                    (THIS REPOSITORY)   |
|  - Framework-free PHP, PSR-4 autoloaded under GuideMap\         |
|  - Parser + storage: Takeout export -> Contribution -> repo     |
|  - Automation: OAuth token refresh, Drive client, Sync          |
|    orchestrator -- all behind Http / Clock interface seams      |
|  - SQLite + in-memory fake implementations for dev and tests    |
|  - Zero WordPress, zero global state                            |
+----------------------------------------------------------------+
```

The dependency arrow points **upward only**. Layer 1 knows nothing about
Layer 2. The WordPress plugin will `require` the `src/` tree (or a copy of it)
and add a thin integration shell — no rewrites of the parser, storage, or sync
logic.

**Everything under `src/` is WordPress-free** — no `wp_*` calls, no `$wpdb`, no
globals, no superglobals. That is a hard rule, and it is what keeps the whole
library testable from the command line.

---

## 2. Component diagram — the parse / store pipeline

```
   Takeout export (.zip / .json / .geojson)
                 |
                 v
        +------------------+
        |  TakeoutParser   |  extract zip, walk files, route by name/shape
        +------------------+
                 |  decoded JSON arrays
                 v
        +------------------+
        |  Type parsers    |  ReviewsParser . StarredParser .
        |                  |  PhotosParser . QuestionsParser
        +------------------+
                 |  uses
                 v
        +------------------+
        |  PropertyFinder  |  case-insensitive, dot-path field lookup
        |  Coordinates     |  GeoJSON [lng,lat] order resolution
        |  DateParser      |  tolerant date/timestamp normalization
        +------------------+
                 |  normalized fields
                 v
        +------------------+
        |  Contribution    |  readonly value object; computes its
        |  ::create()      |  own dedup hash on construction
        +------------------+
                 |  Contribution[]  (wrapped in ParseResult)
                 v
        +------------------------------+
        |  ContributionRepository      |  interface
        |   - SqliteContributionRepo   |  PDO + SQLite (dev/tests)
        |   - WpdbContributionRepo     |  $wpdb (LATER -- not built)
        +------------------------------+
                 |  stored rows
                 v
        +------------------------------+
        |  (LATER) WP shortcodes/blocks |  render map + grid
        +------------------------------+
```

"Normalizer" in the Parser → Normalizer → Repository pipeline is **not a single
class**. Normalization is performed cooperatively by `PropertyFinder` (resolves
the many Takeout field-name spellings to one value), `Coordinates` (applies the
GeoJSON `[lng, lat]` ordering rule), `DateParser` (coerces strings/timestamps
to `DateTimeImmutable`), and each type parser (maps raw fields onto the
`Contribution` shape, rounds coordinates, drops junk rows). The result is a
fully-formed `Contribution` value object.

---

## 3. The automation layer (OAuth + Drive + Sync)

Beyond the file-in / rows-out pipeline above, the library can fetch exports
**automatically from Google Drive**. This layer is just as framework-free as
the parser, and runs under PHPUnit (and the `sync-simulator.php` smoke test)
with no network, no credentials, and no WordPress.

```
        +--------------------+
        |  SyncOrchestrator  |  list folder; per new file: download,
        +--------------------+  parse, store, dedupe, mark processed
           |             |
           |             +---------->  TakeoutParser -> ContributionRepository
           |                                          (the pipeline in section 2)
           v
        +--------------------+
        |  DriveClient       |  Drive v3: list a folder, stream-download a file
        +--------------------+
           |  Authorization: Bearer <token>
           v
        +--------------------+
        |  TokenProvider     |  GoogleTokenProvider: refresh-token grant,
        |  (+ TokenCache)    |  result cached until it nears expiry
        +--------------------+
           |  depends only on
           v
        +--------------------+
        |  HttpClient        |  CurlHttpClient in production;
        |  Clock             |  FakeHttpClient + FrozenClock in tests
        +--------------------+

  ProcessedFilesStore -- remembers which Drive files were already imported,
                         keyed on Drive file id, so a re-sync is a no-op.
```

The seams that make this testable are `HttpClient`, `Clock`, `TokenProvider`,
`TokenCache`, and `ProcessedFilesStore` — all interfaces. Each has a production
implementation (`CurlHttpClient`, `SystemClock`, `GoogleTokenProvider`, …) and
an in-memory/fake counterpart (`FakeHttpClient`, `FrozenClock`,
`StaticTokenProvider`, `InMemoryTokenCache`, `InMemoryProcessedFilesStore`)
kept in `src/` beside it (DECISIONS.md D16). The WordPress adapter will need to
add only two persistence implementations — a `$wpdb`/options-backed
`TokenCache` and `ProcessedFilesStore` — plus an OAuth redirect endpoint and a
WP-Cron trigger. The orchestration they feed into is already built and proven.

Resilience: `SyncOrchestrator` handles each file in isolation. A download
failure, a corrupt zip, or a storage error is recorded against that file and
the run continues; a file is marked processed only after it is stored
successfully, so a failed file is retried on the next sync.

---

## 4. Data flow

End to end, a single export moves through these stages:

```
 Takeout ZIP
   |
   |-> Extract        -> unzip into sys_get_temp_dir()/guidemap-<uniqid>
   |                     (a bare .json/.geojson skips this stage)
   |
   |-> Detect type    -> route each file by filename keyword first
   |                     (reviews/starred/photos/questions), then fall
   |                     back to inspecting the JSON structure
   |
   |-> Parse          -> the matching type parser walks the records
   |
   |-> Normalize      -> PropertyFinder resolves field-name variants;
   |                     DateParser coerces dates; [lng,lat] GeoJSON
   |                     order is honored; lat/lng rounded to 7 places;
   |                     rows with lat==0 AND lng==0 are skipped, and
   |                     rows with no parseable date are skipped with an
   |                     error (DECISIONS.md D14)
   |
   |-> Hash           -> Contribution::create() computes a SHA-256 over
   |                     the stable identifying fields for that type
   |
   |-> Dedupe         -> the hash column is UNIQUE; insertMany() uses
   |                     INSERT OR IGNORE so re-importing the same
   |                     export is a no-op (duplicates counted, not errors)
   |
   |-> Store          -> rows land in the `contributions` table via the
                         repository; temp extraction dir is removed in a
                         finally block whether parsing succeeds or fails
```

When the export is fetched from Drive instead of supplied directly, the
`SyncOrchestrator` prepends three stages — *list folder*, *skip already-processed
files*, *stream-download* — and then feeds the downloaded zip into exactly the
flow above.

Failures are handled at two levels:

- **Fatal, whole-input problems** (missing file, unreadable file, a zip that
  will not open) throw typed exceptions from `GuideMap\Parser\Exception\`.
- **Per-file problems** (one malformed JSON file inside an otherwise good zip,
  an unrecognized file shape, a record with no parseable date) are collected as
  strings — in `ParseResult::$errors`, and in turn in `SyncResult::$errors` —
  so one bad file or record never aborts the rest of the import.

---

## 5. Why this split

- **Testability.** The parser, repository, and the entire Drive sync run from
  the command line under PHPUnit with no WordPress, no MySQL, no web server,
  and no network. A full parse → store → query cycle, and a full Drive sync,
  each execute against in-memory implementations in milliseconds.
- **No WordPress dependency for the hard parts.** The genuinely difficult code
  — coping with Takeout's inconsistent field names, GeoJSON coordinate order,
  date formats, deduplication, OAuth token refresh, and Drive pagination — is
  plain PHP. It can be reasoned about and fuzzed without booting a CMS.
- **Easy to port later.** The WordPress plugin implements a handful of small
  interfaces (`ContributionRepository`, `TokenCache`, `ProcessedFilesStore`),
  registers an uploader and an OAuth endpoint, and renders output. The schema
  is generic SQL with a documented MySQL variant, so the dev SQLite database
  and the production MySQL table are column-for-column identical.
- **Swappable everything.** Callers depend on interfaces, never concrete
  classes, so SQLite → `$wpdb`, cURL → a WordPress HTTP wrapper, and in-memory
  caches → `$wpdb` options are all constructor changes, not refactors.

---

## 6. Open questions for later

These are intentionally **left unresolved**. They need product input or a
WordPress environment to decide and should not be guessed at now.

- **[OPEN] WordPress data ownership.** One global contributions table, or
  per-user/per-author rows? Multisite behavior is undecided.
- **[OPEN] Plugin distribution & vendoring.** The shipped plugin will not run
  `composer install` on the host. Do we copy `src/` into the plugin, commit a
  pruned `vendor/`, or build a release artifact?
- **[OPEN] OAuth callback & credential storage.** The refresh-token *consumer*
  is built (`GoogleTokenProvider`); the *acquisition* half — the Google consent
  redirect, the callback handler that exchanges the auth code, and where the
  `OAuthCredentials` are stored — is a WordPress-adapter concern not yet built.
- **[OPEN] Sync scheduling & backoff.** What triggers `SyncOrchestrator::run()`
  (WP-Cron? a manual admin button?), how often, and how `RateLimited` (HTTP
  429) should drive a retry/backoff policy, are all undecided.
- **[OPEN] Re-import / sync semantics.** Today re-importing is idempotent via
  the hash. Should a later export that *removes* a contribution also remove the
  stored row, or is the store append-only?
- **[OPEN] Photo view counts over time.** `photo_views` is a point-in-time
  snapshot. Tracking history would need a separate table.
- **[OPEN] Authoritative Takeout schema.** Field-name variants here are handled
  defensively from observed exports. A real export may reveal more spellings or
  a `questions`/`photos` shape we have not modeled.
- **[OPEN] Geocoding gaps.** Some contributions (notably questions) may lack
  coordinates and are currently dropped. Whether to geocode them, or render
  them in a list-only view, is undecided.
- **[OPEN] Front-end rendering.** Map library, block vs. shortcode, and theme
  styling are all Layer 2 concerns not yet specified.

---

## 7. Directory map

```
src/
  Contribution.php             value object + dedup-hash factory
  ContributionType.php         enum: Review | Photo | Starred | Question
  Parser/
    TakeoutParser.php          entry point: zip/json -> ParseResult
    ReviewsParser.php          one Takeout file type -> TypeParseResult
    StarredParser.php
    PhotosParser.php
    QuestionsParser.php
    PropertyFinder.php         tolerant, case-insensitive field lookup
    Coordinates.php            GeoJSON [lng,lat] coordinate resolution
    DateParser.php             tolerant date normalization
    ParseResult.php            { contributions, errors, filesProcessed }
    TypeParseResult.php        { contributions, errors } from one parser
    Exception/                 typed parser exceptions
  Storage/
    Schema.php                 SQLite + MySQL DDL (one source of truth)
    ContributionRepository.php  storage interface
    SqliteContributionRepository.php   PDO/SQLite implementation
    InsertResult.php           { inserted, duplicates, attempted }
    Stats.php                  { total, byType, averageRating, dates }
  Http/
    HttpClient.php             interface: request() + download()
    HttpResponse.php           { statusCode, headers, body }
    CurlHttpClient.php         production cURL implementation
    FakeHttpClient.php         in-memory test / simulator double
    Exception/                 HttpRequestFailed
  Clock/
    Clock.php                  interface: now()
    SystemClock.php            production implementation
    FrozenClock.php            controllable test double
  OAuth/
    OAuthCredentials.php       { clientId, clientSecret, refreshToken }
    AccessToken.php            { token, expiresAt } + isExpired()
    TokenProvider.php          interface
    GoogleTokenProvider.php    refresh-token grant against Google
    StaticTokenProvider.php    fixed-token double (tests / simulator)
    TokenCache.php             interface
    InMemoryTokenCache.php     in-memory implementation
    Exception/                 InvalidRefreshToken, TokenRefreshFailed
  Drive/
    DriveClient.php            Drive v3: list folder, download file
    DriveFile.php              { id, name, mimeType, modifiedTime, size }
    Exception/                 DriveApiError, FileNotFound, RateLimited
  Sync/
    SyncOrchestrator.php       the automation "brain"
    SyncResult.php             counts + errors + syncedAt
    ProcessedFilesStore.php    interface
    InMemoryProcessedFilesStore.php   in-memory implementation
tests/                         PHPUnit suite mirroring src/
fixtures/                      realistic sample Takeout JSON + sample zip
scripts/
  parse-takeout.php            CLI smoke test: parser + storage
  sync-simulator.php           CLI smoke test: full Drive sync, faked
  build-sample-zip.php         regenerates fixtures/takeout-sample.zip
docs/                          supplementary reference documentation
_archive/                      the previous React/Vercel scraper
```

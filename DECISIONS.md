# Decisions

A running log of choices made while building the GuideMap Pro core library.
Each entry records the decision and the reasoning, so a later session (or the
WordPress integration work) does not have to re-derive it.

The brief said: "If you hit ambiguity, pick the option that keeps the code
framework-free and decision-free." Every entry below follows that rule.

---

## D1 — Repository pattern over Active Record

**Decision:** Persistence goes through a `ContributionRepository` *interface*.
The domain object `Contribution` is a plain value object and knows nothing
about the database.

**Why:** The whole point of the core library is that the same code runs on
SQLite during development and on WordPress's `$wpdb`/MySQL in production. With
Active Record, the row *is* the model, so the model is welded to one database
driver — porting means rewriting the domain object. With the repository
pattern, the WordPress port is a single new class, `WpdbContributionRepository`,
that implements the existing interface. Callers depend on the interface, so
nothing else changes. It also makes testing trivial: tests run against
`SqliteContributionRepository` with an in-memory database, and a fake
implementing the interface can be dropped in anywhere.

---

## D2 — SQLite for local development

**Decision:** Local dev and the entire test suite use SQLite (file-based, or
`:memory:` for tests).

**Why:** Zero setup — no server to install, no daemon to run, no credentials.
The database is a single file (or purely in memory) that can be deleted and
recreated freely. This lets the brief's requirement — "validate today without
any infrastructure" — actually hold. SQLite's SQL dialect is close enough to
MySQL that one generic schema covers both (see D5). When the WordPress adapter
arrives it will use MySQL via `$wpdb`; SQLite is strictly a dev/test backend
and never ships in the plugin.

---

## D3 — Composer + PSR-4 even though the plugin will not ship Composer

**Decision:** Development uses Composer for autoloading (PSR-4, `GuideMap\` →
`src/`) and for the PHPUnit dev dependency. The final WordPress plugin will
**not** run `composer install` on the host.

**Why:** Composer + PSR-4 gives a clean, conventional dev environment: no
hand-written `require` lists, autoloaded tests, one command to get PHPUnit.
That convenience is worth having now. It does not commit the *plugin* to
Composer — the shipped plugin can bundle a tiny static autoloader, or copy
`src/` in directly, because the source is already organized as strict PSR-4
(one class per file, namespace mirrors directory). The dev tooling and the
distribution mechanism are kept as separate concerns. (How exactly the plugin
vendors the code is an explicit open question in ARCHITECTURE.md.)

---

## D4 — Deduplication via a per-type SHA-256 hash

**Decision:** Every `Contribution` carries a `hash` — a SHA-256 over the
*stable identifying fields* for its type. The storage table has a `UNIQUE`
constraint on `hash`, and `insertMany()` uses `INSERT OR IGNORE`, so importing
the same export twice inserts each contribution exactly once.

**Hash inputs per type** (`|` is a literal separator; the trailing word
namespaces the hash so different types can never collide):

| Type     | Hashed payload                                              |
|----------|-------------------------------------------------------------|
| Review   | `googleMapsUrl + "\|" + date("Y-m-d") + "\|review"`         |
| Starred  | `googleMapsUrl + "\|starred"`                               |
| Photo    | `placeName + "\|" + date(unix timestamp) + "\|photo"`       |
| Question | `googleMapsUrl + "\|" + first 50 chars of text + "\|question"` |

**Why these fields:** They are the values least likely to change between two
exports of the same underlying contribution, and they identify it uniquely:

- A *review* is one-per-place-per-day for a user — the place URL plus the
  publish date pins it down. Day granularity (`Y-m-d`) is used deliberately: a
  re-export must hash identically even if a time component drifts. The
  practical cost — a user reviewing the same place twice on one calendar day —
  is treated as a duplicate, which is acceptable.
- A *starred* place is simply one-per-place; the URL alone is enough.
- A *photo* has no reliable place URL, so its title plus capture timestamp is
  used. The Unix timestamp is exact and stable.
- A *question* is keyed by the place it was asked about plus a prefix of the
  question text, since one user can ask several questions about one place.

The hash is computed in `Contribution::create()` so a value object can never
exist without a correct hash. `Contribution::computeHash()` is public and
static so tests can assert hash stability directly.

---

## D5 — One generic schema, two documented dialects

**Decision:** `Storage\Schema` is the single source of truth for the table. It
exposes a SQLite DDL string (used by dev/tests) and a MySQL DDL string (for the
future WordPress plugin). The column list is identical between the two; only
the type spellings and the auto-increment syntax differ, and the difference is
commented inline.

**Why:** The brief requires the dev database to "mirror the MySQL schema." A
single class holding both variants guarantees they never drift apart. Generic
SQL (no MySQL-only features) keeps SQLite and MySQL interchangeable. The
`id INTEGER PRIMARY KEY AUTOINCREMENT` (SQLite) vs.
`id BIGINT UNSIGNED ... AUTO_INCREMENT` (MySQL) swap is the only structural
difference and is called out in the file.

---

## D6 — 7 decimal places for latitude / longitude

**Decision:** Coordinates are rounded to **7 decimal places** in
`Contribution::create()`, and stored as `DECIMAL(10,7)` in the MySQL schema.

**Why:** 7 decimal places of latitude/longitude is roughly 11 mm of ground
precision — far finer than any consumer GPS or map pin needs, and the
precision Google Takeout itself emits. Rounding at the value-object boundary
means the dev SQLite `REAL` column and the prod MySQL `DECIMAL(10,7)` column
hold the same numbers, so the dedup hash and any coordinate comparison behave
identically on both backends. `DECIMAL(10,7)` holds the full longitude range
(−180 to 180) with 7 fractional digits.

---

## D7 — PHP 8.2 as the minimum version

**Decision:** `composer.json` requires `php: >=8.2`, not the "8.0+" mentioned
in the brief.

**Why:** The brief asked for an `enum` (PHP 8.1+) and `readonly` value-object
classes (`readonly class` is PHP 8.2+) — features that cannot run on 8.0 or
8.1 at all, so "8.0+" was not literally achievable. Of the versions that *can*
run the requested code, 8.2 is the lowest that is still in active support: PHP
8.1's security support ended 2025-12-31, so targeting it would mean shipping
against an end-of-life runtime. 8.2 is therefore the floor — it supports every
language feature the brief requested and is a currently-supported release.
PHPUnit 10 also requires 8.1+, so this is consistent. This is a decision the
WordPress hosting requirement should revisit, but 8.2+ is well within range for
any current WordPress host.

---

## D8 — Value objects use `readonly class`

**Decision:** `Contribution`, `ParseResult`, `InsertResult`, and `Stats` are
`final readonly class` with constructor-promoted properties.

**Why:** These are immutable values — once parsed, a contribution does not
change. `readonly` makes that a compiler-enforced guarantee instead of a
convention, and `final` prevents subclasses from weakening it. It also keeps
the objects safe to pass around the (future) WordPress layer without defensive
copying.

---

## D9 — Old React scraper moved to `_archive/`, not deleted

**Decision:** The entire previous repository (the React/Vite/Vercel profile
scraper) was moved wholesale into `_archive/`. Nothing was deleted.

**Why:** The brief asked for this explicitly, to preserve the old scraper for
reference. A side effect worth noting: the old GitHub Actions workflows
(`scrape-profile.yml`, `update-profile.yml`) moved with it into
`_archive/.github/`. GitHub only runs workflows from `.github/` at the repo
root, so this **deactivates the old scraper automation** — which is the
intended outcome of the pivot. No new workflows were added; CI for the PHP
library is out of scope for this foundation pass.

---

## D10 — Sub-parsers consume decoded arrays, not file paths

**Decision:** `TakeoutParser` owns all file I/O (zip extraction, reading,
`json_decode`). The four type parsers (`ReviewsParser`, etc.) each expose
`parse(array $data): array` and operate purely on already-decoded data.

**Why:** It puts every I/O concern (and every I/O failure mode) in one place,
and makes the type parsers pure functions of their input — trivial to unit
test with literal array fixtures, no temp files required.

---

## D11 — Errors: throw for fatal, collect for per-file

**Decision:** `TakeoutParser::parse()` throws a typed exception
(`UnreadableFile`, `ZipExtractFailure`) only for problems that invalidate the
*whole* input. A problem with a single file inside a zip (malformed JSON,
unrecognized shape) is recorded as a string in `ParseResult::$errors` and
parsing continues with the remaining files.

**Why:** A real Takeout export is many files. One corrupt file should not throw
away every other contribution. Surfacing per-file problems as data (rather than
exceptions) lets the caller — the CLI script today, the WordPress admin screen
later — show a partial-success report. `filesProcessed` counts only files that
decoded and routed successfully.

---

## D12 — Missing dates default to the Unix epoch

**Decision:** `Contribution::$date` is a non-nullable `DateTimeImmutable`
(matching the brief, which marked `rating` and `reviewText` nullable but not
`date`). When a Takeout record carries no usable date, the parser substitutes
`1970-01-01T00:00:00+00:00`.

**Why:** Keeping `date` non-nullable removes a null check from every consumer
(stats, filters, rendering). The epoch is an unmistakable sentinel — any
"1970" date in the data clearly means "Takeout gave us no date" rather than a
plausible-but-wrong guess like "today". Date filtering and `MIN`/`MAX` stats
still work because the epoch simply sorts first.

---

## D13 — `.geojson` accepted everywhere `.json` is

**Decision:** Inside a zip, `TakeoutParser` collects both `.json` and
`.geojson` files (the brief only named `.json` for the zip path but named both
for the direct-file path).

**Why:** Google Takeout's starred/saved places file is GeoJSON and is sometimes
emitted with a `.geojson` extension. Accepting both everywhere is strictly more
tolerant, costs nothing, and removes a way for a real export to silently lose
data. Type detection does not depend on the extension regardless.

---

## D14 — Date-less records are skipped, not dated to the epoch (reverses D12)

**Decision:** When a Takeout record has no parseable date, the type parsers now
**skip the contribution entirely** and record an error
`Skipped {type} '{place_name}' — no parseable date`, instead of substituting
the Unix epoch as D12 prescribed.

**Why:** Review feedback on PR #2 flagged the epoch default as a
stats-pollution risk. A contribution dated 1970-01-01 silently drags down
`MIN(date)`, widens every "earliest … latest" range, and drops a fake point on
any timeline — all from data Google never actually gave us. A handful of
genuinely date-less records is better dropped (and reported) than kept with a
fabricated date that quietly corrupts every aggregate. `Contribution::$date`
stays a non-nullable `DateTimeImmutable`, so every *stored* contribution still
has a real date.

**Mechanics:** `DateParser::tryParse()` was added — it returns `null` instead
of the epoch when a value cannot be parsed. The parsers call `tryParse()` and
skip on `null`. `DateParser::parse()` is kept as the lenient epoch-fallback
variant for any caller that needs a guaranteed date. To carry the new skip
errors out of the (previously array-returning) type parsers, their `parse()`
now returns a `TypeParseResult` value object `{ contributions, errors }`, which
`TakeoutParser` merges into the file-level `ParseResult`.

---

## D15 — `HttpClient` has a `download()` method alongside `request()`

**Decision:** The `Http\HttpClient` interface declares two methods —
`request()` (returns an in-memory `HttpResponse`) and `download()` (streams the
response body straight to a file path).

**Why:** Phase 9 described `HttpClient` as "one method", but Phase 11 requires
`DriveClient::downloadFile()` to stream a Takeout zip to disk "to avoid loading
the whole ZIP into memory", and `DriveClient` depends only on the `HttpClient`
interface. A streaming capability therefore has to live on that interface — an
in-memory `request()` cannot satisfy the explicit no-buffering requirement. The
detailed, rationale-backed instruction wins over the "one method" sketch.
`CurlHttpClient::download()` uses `CURLOPT_FILE`; `FakeHttpClient::download()`
writes the canned body to the path.

---

## D16 — Test doubles live in `src/`, not `tests/`

**Decision:** `FakeHttpClient`, `FrozenClock`, `InMemoryTokenCache`, and
`InMemoryProcessedFilesStore` are production classes under `src/`, beside the
interfaces they implement — not test-only helpers under `tests/`.

**Why:** The brief explicitly places these classes in `src/`, and that is the
right call: the in-memory implementations are genuinely useful outside of unit
tests — the Phase 13 CLI sync simulator runs the whole orchestrator on
`FakeHttpClient` with no test framework involved, and a future WordPress
"dry-run" mode could reuse them too. They are part of the library's public
surface, so they are versioned, autoloaded, and documented like any other
class.

---

## D17 — `FakeHttpClient` matches canned responses by URL prefix, with queues

**Decision:** `FakeHttpClient` is constructed with responses keyed by
`"{METHOD} {URL}"`. A request is matched to the **longest registered key that
is a prefix of** its `"{METHOD} {URL}"` string. A key may map to a single
response or to a list of responses returned in sequence (the last one repeats).

**Why:** Exact-string matching would force every test to reproduce Google's
exact query-string encoding (`q=...&fields=...&pageSize=...`), making tests
brittle against harmless query tweaks. Prefix matching lets a test register
`"GET https://www.googleapis.com/drive/v3/files"` and have it answer the real,
fully-parameterized request. Response queues make pagination testable: the
Drive list endpoint is hit twice (page 1, then page 2 with a `pageToken`) and
both requests prefix-match the same key, so a two-element queue returns page 1
then page 2. The constructor still takes an `array` keyed by `"{METHOD} {URL}"`
exactly as the brief specified.

---

## D18 — Streaming downloads keep Takeout zips out of PHP memory

**Decision:** `DriveClient::downloadFile()` streams the file to disk via
`HttpClient::download()` rather than fetching it into a string and writing that
string out.

**Why:** A Google Takeout export can be hundreds of megabytes. Buffering it in
a PHP string risks exhausting `memory_limit`, and on shared WordPress hosting
`memory_limit` is often low. `CURLOPT_FILE` hands cURL an open file handle so
bytes go disk-to-disk and peak memory stays flat regardless of export size.

---

## D19 — Processed-file dedup is keyed on the Drive file id

**Decision:** `SyncOrchestrator` records which Drive files it has already
imported in a `ProcessedFilesStore`, keyed by the **Drive file id**. A file
whose id is already in the store is skipped without being downloaded.

**Why:** The Drive file id is stable and unique for the lifetime of the file,
so it is the cheapest reliable "have I seen this?" key — the check happens
before any download, so re-syncs cost one Drive list call and nothing else.
This is a coarse, file-level guard that complements (does not replace) the
contribution-level SHA-256 dedup (D4): even if the same file were processed
twice, the repository's `INSERT OR IGNORE` still prevents duplicate rows. Two
independent layers, cheap at the file level and exact at the row level.

---

## D20 — The sync layer stays as framework-free as the parser

**Decision:** Everything added in Phases 9–13 (`Http`, `Clock`, `OAuth`,
`Drive`, `Sync`) lives under `src/` with no WordPress dependency, mirroring the
parser/storage layers. WordPress-specific implementations
(`WpOptionsTokenCache`, `WpOptionsProcessedFilesStore`, an admin OAuth callback)
are explicitly deferred to the future adapter layer.

**Why:** The same reasoning as D1/D10: the hard logic — token refresh with an
expiry buffer, Drive pagination, sync orchestration with per-file error
isolation — is verified from the command line with `FrozenClock` and
`FakeHttpClient`, with no CMS, no network, and no credentials. The WordPress
adapter then only has to supply two small persistence classes and wire an
OAuth redirect URL; the orchestration it calls into is already proven.

---

## D21 — `SyncResult` carries a `syncedAt` timestamp

**Decision:** `SyncResult` has a sixth field beyond the five Phase 12 listed —
`syncedAt`, a `DateTimeImmutable` — set from the injected `Clock`.

**Why:** Phase 12 injects a `Clock` into `SyncOrchestrator`, but its five listed
`SyncResult` fields gave that clock nothing to do. An unused injected
dependency is a worse outcome than a sixth field. "When did this sync run" is
the obvious, genuine time-related fact a sync result should carry — useful for
logging and for a future "only files modified since the last sync"
optimisation — and stamping it from the `Clock` (rather than a bare
`new DateTimeImmutable()`) keeps the orchestrator fully deterministic under
`FrozenClock` in tests, which is the whole reason a `Clock` is injected at all.

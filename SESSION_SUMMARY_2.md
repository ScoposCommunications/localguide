# Session Summary 2 — Sync layer (Phases 8–14)

This session followed up the framework-free foundation (Phases 1–7, PR #2) with
a review fix and a complete, framework-free Google Drive sync layer: HTTP and
clock abstractions, an OAuth token manager, a Drive API client, and a sync
orchestrator. **All seven phases (8–14) are complete. 203 tests pass. No
WordPress adapter work was started.**

---

## What was done, by phase

8. **Epoch-default fix.** Date-less records are now skipped (with an error)
   instead of being dated to the Unix epoch — the stats-pollution bug from the
   PR #2 review.
9. **HTTP + Clock abstractions.** `HttpClient` and `Clock` interfaces, with
   production (cURL, system) and fake/frozen implementations.
10. **OAuth token manager.** `GoogleTokenProvider` refreshes Google access
    tokens, caches them, and refreshes early via an expiry buffer.
11. **Drive API client.** `DriveClient` lists a Drive folder (with pagination)
    and stream-downloads a file.
12. **Sync orchestrator.** `SyncOrchestrator` ties it together: list → download
    → parse → store → dedupe, with per-file error isolation.
13. **CLI sync simulator.** `scripts/sync-simulator.php` runs the whole sync
    against an in-process fake Drive.
14. **Docs.** `ARCHITECTURE.md`, `DECISIONS.md`, `README.md` updated.

---

## Files created (27 in `src/`, 8 tests, 1 script)

### `src/` — new

- `Parser/TypeParseResult.php` — `{ contributions, errors }` returned by each
  type parser so date-skip errors can travel up to `ParseResult`.
- `Http/HttpClient.php` (interface), `HttpResponse.php`, `CurlHttpClient.php`
  (production), `FakeHttpClient.php` (test/simulator double),
  `Http/Exception/HttpRequestFailed.php`.
- `Clock/Clock.php` (interface), `SystemClock.php`, `FrozenClock.php`.
- `OAuth/OAuthCredentials.php`, `AccessToken.php`, `TokenProvider.php`
  (interface), `GoogleTokenProvider.php`, `StaticTokenProvider.php`,
  `TokenCache.php` (interface), `InMemoryTokenCache.php`,
  `OAuth/Exception/InvalidRefreshToken.php`, `TokenRefreshFailed.php`.
- `Drive/DriveFile.php`, `DriveClient.php`,
  `Drive/Exception/DriveApiError.php`, `FileNotFound.php`, `RateLimited.php`.
- `Sync/ProcessedFilesStore.php` (interface), `InMemoryProcessedFilesStore.php`,
  `SyncResult.php`, `SyncOrchestrator.php`.

### `src/` — modified (Phase 8)

- `Parser/DateParser.php` — added `tryParse()` (returns `null`, not the epoch,
  on failure); `parse()` kept as the lenient variant.
- `Parser/ReviewsParser.php`, `StarredParser.php`, `PhotosParser.php`,
  `QuestionsParser.php` — `parse()` now returns `TypeParseResult`; a record
  with no parseable date is skipped with an error.
- `Parser/TakeoutParser.php` — merges each parser's errors into `ParseResult`.

### `tests/` — new (8 files)

- `Clock/ClockTest.php`
- `Http/HttpResponseTest.php`, `Http/FakeHttpClientTest.php`
- `OAuth/AccessTokenTest.php`, `OAuth/GoogleTokenProviderTest.php`
- `Drive/DriveClientTest.php`
- `Sync/SyncOrchestratorTest.php`
- `Cli/SyncSimulatorScriptTest.php`

`tests/Parser/{DateParser,Reviews,Starred,Photos,Questions}ParserTest.php` were
updated for the new return type and gained a "skips a record with no parseable
date" test each.

### `scripts/` — new

- `sync-simulator.php` — runs `SyncOrchestrator` against a fake Drive serving
  the bundled sample export; does a fresh sync then an idempotent re-sync.

### Docs — modified

- `ARCHITECTURE.md` — added section 3 (the OAuth/Drive/Sync layer) with a
  component diagram; restated that all of `src/` is WordPress-free; refreshed
  the data flow, open questions, and directory map.
- `DECISIONS.md` — added **D14–D21**.
- `README.md` — current state, roadmap, and the sync-simulator instructions.
- `composer.json` / `composer.lock` — added the `ext-curl` requirement.

---

## Tests

**203 tests, 521 assertions — all passing** (up from 139 at the end of PR #2).
Highlights of the new coverage:

- **Phase 8** — each parser skips a date-less record and reports it; `DateParser`
  `tryParse()` returns `null` for missing/empty/garbage input.
- **Phase 9** — `FakeHttpClient` prefix matching, response queues, request
  recording, streamed downloads; `FrozenClock` advance/set.
- **Phase 10** — valid cached token returned with zero HTTP; expired/near-expiry
  token triggers refresh + cache write; 400/401 → `InvalidRefreshToken`;
  5xx / malformed body → `TokenRefreshFailed`; expiry-buffer window.
- **Phase 11** — list success / empty / pagination; download success; 404 →
  `FileNotFound` (and no error file left on disk); 429 → `RateLimited`; bearer
  header present.
- **Phase 12** — fresh sync, idempotent re-sync, new-file-appears, corrupt file
  isolated, download failure isolated, cross-file dedup, parse-skip surfacing,
  `syncedAt` from the clock.
- **Phase 13** — `sync-simulator.php` exercised end-to-end as a subprocess.

### Coverage note

No coverage driver (Xdebug or PCOV) is installed in this environment, so line
coverage could not be machine-measured. The suite is written to exercise every
class, every public method, and every documented branch across the new `Http`,
`Clock`, `OAuth`, `Drive`, and `Sync` namespaces.

---

## Verification performed

- `vendor/bin/phpunit` — **203 tests, 521 assertions, all passing.**
- `php -l` — clean on every file in `src/`, `tests/`, and `scripts/`.
- `php scripts/parse-takeout.php fixtures/takeout-sample.zip` — 16 contributions
  from 4 files (unchanged from PR #2).
- `php scripts/sync-simulator.php` — run 1 processes 3 files (16 inserted, 32
  skipped as duplicates, since it is the same export three times); run 2 is
  idempotent (0 processed); 16 rows stored.
- `composer validate` — passes.

---

## Decisions recorded this session

`DECISIONS.md` **D14–D21**:

- **D14** — date-less records are skipped, not epoch-dated (reverses D12).
- **D15** — `HttpClient` has a `download()` method alongside `request()`.
- **D16** — test doubles (`FakeHttpClient`, `FrozenClock`, …) live in `src/`.
- **D17** — `FakeHttpClient` matches canned responses by URL prefix, with queues.
- **D18** — streaming downloads keep Takeout zips out of PHP memory.
- **D19** — processed-file dedup is keyed on the Drive file id.
- **D20** — the sync layer stays as framework-free as the parser.
- **D21** — `SyncResult` carries a `syncedAt` timestamp (gives the injected
  `Clock` a genuine use).

---

## Where I left off

Phases 8–14 are **complete and verified**. Per the brief I **stopped here** and
did **not** start the WordPress adapter layer or the OAuth callback handler.

The core library now covers the entire pipeline from "a Takeout export sitting
in a Google Drive folder" to "deduplicated rows in a repository", with every
external dependency (HTTP, the clock, OAuth, Drive, persistence) behind an
interface and exercised by tests with no network.

When you are ready to continue, the **WordPress adapter layer** is the next
body of work. In dependency order, the exact next steps are:

> 1. `src/Storage/WpdbContributionRepository.php` — implement the existing
>    `ContributionRepository` interface against `$wpdb`, reusing
>    `Schema::mysql()` (substitute `$wpdb->prefix` and
>    `$wpdb->get_charset_collate()`; translate `INSERT OR IGNORE` to MySQL
>    `INSERT IGNORE`). `SqliteContributionRepositoryTest` is its behavioral
>    contract.
> 2. `WpOptionsTokenCache` and `WpOptionsProcessedFilesStore` — implement the
>    `TokenCache` and `ProcessedFilesStore` interfaces against the WordPress
>    options API.
> 3. The plugin shell — activation hook (runs the MySQL DDL), the Google OAuth
>    consent + callback endpoint (this is the unbuilt half of OAuth: it
>    acquires the refresh token that `GoogleTokenProvider` consumes), a WP-Cron
>    job that calls `SyncOrchestrator::run()`, and an admin uploader for manual
>    imports — all with capability/nonce checks.
> 4. Front-end rendering — shortcodes/blocks for the map and contribution grid.

The open questions to resolve with product input before that work — data
ownership, plugin vendoring, sync scheduling/backoff, OAuth credential storage
— are listed at the end of `ARCHITECTURE.md`.

To get oriented in a fresh session: read `ARCHITECTURE.md`, then
`SESSION_SUMMARY.md` (Phases 1–7) and this file (Phases 8–14), then run
`composer install && vendor/bin/phpunit`.

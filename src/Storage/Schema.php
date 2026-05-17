<?php

declare(strict_types=1);

namespace GuideMap\Storage;

/**
 * The single source of truth for the `contributions` table.
 *
 * Two dialects are provided from one column list:
 *
 *  - {@see Schema::sqlite()} — used by {@see SqliteContributionRepository} for
 *    local development and the test suite.
 *  - {@see Schema::mysql()} — the production dialect for the future WordPress
 *    plugin (which will create the table through `$wpdb`).
 *
 * The column list, names and order are identical between the two. Only the
 * type spellings and the auto-increment syntax differ — see the inline
 * comments in each method. Keeping both variants here guarantees the dev and
 * prod schemas cannot drift apart. See DECISIONS.md (D5).
 *
 * Columns
 *  - id              surrogate primary key
 *  - place_name      contributed place name
 *  - place_address   contributed place address ('' when unknown)
 *  - lat / lng       coordinates, 7 decimal places (DECISIONS.md D6)
 *  - google_maps_url canonical Google Maps URL ('' when unknown)
 *  - type            ContributionType backing value
 *  - rating          1-5 star rating; NULL for non-review types
 *  - review_text     review body / question text; NULL when absent
 *  - date            contribution date, 'Y-m-d H:i:s', UTC
 *  - photo_views     view count for photos; 0 for other types
 *  - hash            SHA-256 dedup key; UNIQUE
 *  - created_at      row insertion timestamp
 */
final class Schema
{
    /** Table name, identical on SQLite and MySQL. */
    public const TABLE = 'contributions';

    /**
     * SQLite DDL — used for local dev and tests.
     *
     * The id column is `INTEGER PRIMARY KEY AUTOINCREMENT`; the MySQL variant
     * swaps this for `BIGINT UNSIGNED ... AUTO_INCREMENT` + a `PRIMARY KEY`
     * clause. Coordinates use SQLite's `REAL`; MySQL uses `DECIMAL(10,7)`.
     */
    public static function sqlite(): string
    {
        return <<<SQL
            CREATE TABLE IF NOT EXISTS contributions (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                place_name      TEXT    NOT NULL DEFAULT '',
                place_address   TEXT    NOT NULL DEFAULT '',
                lat             REAL    NOT NULL,
                lng             REAL    NOT NULL,
                google_maps_url TEXT    NOT NULL DEFAULT '',
                type            TEXT    NOT NULL,
                rating          INTEGER     NULL,
                review_text     TEXT        NULL,
                date            TEXT    NOT NULL,
                photo_views     INTEGER NOT NULL DEFAULT 0,
                hash            TEXT    NOT NULL,
                created_at      TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE UNIQUE INDEX IF NOT EXISTS uq_contributions_hash ON contributions (hash);
            CREATE INDEX IF NOT EXISTS ix_contributions_type ON contributions (type);
            CREATE INDEX IF NOT EXISTS ix_contributions_date ON contributions (date);
            SQL;
    }

    /**
     * MySQL DDL — the production dialect for the future WordPress plugin.
     *
     * Differences from the SQLite variant, all driven by dialect (not by a
     * change in the data model):
     *  - id: `BIGINT UNSIGNED NOT NULL AUTO_INCREMENT` + explicit PRIMARY KEY,
     *    in place of SQLite's `INTEGER PRIMARY KEY AUTOINCREMENT`;
     *  - lat/lng: `DECIMAL(10,7)` (fixed 7-place precision) vs. SQLite `REAL`;
     *  - text columns get explicit `VARCHAR` lengths; `hash` is `CHAR(64)`;
     *  - indexes are declared inline rather than as separate statements.
     *
     * When the WordPress plugin builds this, it should substitute the real
     * `$wpdb->prefix` and `$wpdb->get_charset_collate()` for the table name
     * and the trailing ENGINE/CHARSET clause.
     */
    public static function mysql(): string
    {
        return <<<SQL
            CREATE TABLE IF NOT EXISTS contributions (
                id              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT,
                place_name      VARCHAR(255)     NOT NULL DEFAULT '',
                place_address   VARCHAR(512)     NOT NULL DEFAULT '',
                lat             DECIMAL(10,7)    NOT NULL,
                lng             DECIMAL(10,7)    NOT NULL,
                google_maps_url VARCHAR(2048)    NOT NULL DEFAULT '',
                type            VARCHAR(16)      NOT NULL,
                rating          TINYINT UNSIGNED     NULL,
                review_text     TEXT                 NULL,
                date            DATETIME         NOT NULL,
                photo_views     INT UNSIGNED     NOT NULL DEFAULT 0,
                hash            CHAR(64)         NOT NULL,
                created_at      TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uq_contributions_hash (hash),
                KEY ix_contributions_type (type),
                KEY ix_contributions_date (date)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            SQL;
    }

    /**
     * Split a DDL script into individual executable statements.
     *
     * PDO's SQLite driver does not reliably run multiple statements in one
     * `exec()` call, so the repository applies the schema statement by
     * statement. The DDL above contains no semicolons inside literals, so a
     * plain split is safe.
     *
     * @return list<string>
     */
    public static function statements(string $ddl): array
    {
        $statements = [];
        foreach (explode(';', $ddl) as $statement) {
            $statement = trim($statement);
            if ($statement !== '') {
                $statements[] = $statement;
            }
        }

        return $statements;
    }
}

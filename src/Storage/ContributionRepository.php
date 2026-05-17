<?php

declare(strict_types=1);

namespace GuideMap\Storage;

use GuideMap\Contribution;

/**
 * Storage contract for contributions.
 *
 * Every caller depends on this interface, never on a concrete class. That is
 * what lets the backend be swapped without touching anything else:
 * {@see SqliteContributionRepository} backs local dev and tests today, and a
 * `WpdbContributionRepository` will implement the same methods against
 * WordPress's `$wpdb` later. See DECISIONS.md (D1).
 */
interface ContributionRepository
{
    /**
     * Insert many contributions. Rows whose dedup hash already exists are
     * skipped, so calling this twice with the same data is idempotent.
     *
     * @param list<Contribution> $contributions
     */
    public function insertMany(array $contributions): InsertResult;

    /**
     * Return stored contributions, newest first, optionally filtered.
     *
     * Recognized filter keys (all optional):
     *  - `type`      ContributionType|string — restrict to one type
     *  - `date_from` string|DateTimeInterface — inclusive lower date bound
     *  - `date_to`   string|DateTimeInterface — inclusive upper date bound
     *  - `search`    string — case-insensitive substring of place name,
     *                address or review text
     *  - `limit`     int — maximum rows returned
     *  - `offset`    int — rows skipped (only applied alongside `limit`)
     *
     * @param array<string, mixed> $filters
     *
     * @return list<Contribution>
     */
    public function all(array $filters = []): array;

    /**
     * Fetch one contribution by primary key, or null if no such row exists.
     */
    public function find(int $id): ?Contribution;

    /**
     * Aggregate statistics across every stored contribution.
     */
    public function stats(): Stats;

    /**
     * Count of stored rows per type, e.g. `['review' => 832, 'photo' => 298]`.
     * Types with no rows are omitted.
     *
     * @return array<string, int>
     */
    public function types(): array;

    /**
     * Total number of stored contributions.
     */
    public function count(): int;

    /**
     * Delete every stored contribution.
     */
    public function truncate(): void;
}

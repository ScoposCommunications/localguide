<?php

declare(strict_types=1);

namespace GuideMap\Tests\Storage;

use DateTimeImmutable;
use DateTimeZone;
use GuideMap\Contribution;
use GuideMap\ContributionType;
use GuideMap\Storage\SqliteContributionRepository;
use GuideMap\Tests\TestCase;

final class SqliteContributionRepositoryTest extends TestCase
{
    private function utc(string $date): DateTimeImmutable
    {
        return new DateTimeImmutable($date, new DateTimeZone('UTC'));
    }

    private function review(
        string $url,
        ?int $rating,
        string $date,
        string $name = 'A Place',
        string $text = 'A review.',
    ): Contribution {
        return Contribution::create(
            $name,
            '1 Some Street',
            1.2345678,
            2.3456789,
            $url,
            ContributionType::Review,
            $rating,
            $text,
            $this->utc($date),
            0,
        );
    }

    private function photo(string $title, string $date, int $views = 100): Contribution
    {
        return Contribution::create(
            $title,
            '',
            3.0,
            4.0,
            '',
            ContributionType::Photo,
            null,
            null,
            $this->utc($date),
            $views,
        );
    }

    public function test_in_memory_factory_starts_empty(): void
    {
        self::assertSame(0, SqliteContributionRepository::inMemory()->count());
    }

    public function test_insert_many_stores_rows_and_reports_the_outcome(): void
    {
        $repository = SqliteContributionRepository::inMemory();

        $result = $repository->insertMany([
            $this->review('u1', 5, '2020-01-01'),
            $this->review('u2', 4, '2021-01-01'),
        ]);

        self::assertSame(2, $result->inserted);
        self::assertSame(0, $result->duplicates);
        self::assertSame(2, $result->attempted);
        self::assertSame(2, $repository->count());
    }

    public function test_inserting_no_contributions_is_a_no_op(): void
    {
        $result = SqliteContributionRepository::inMemory()->insertMany([]);

        self::assertSame(0, $result->inserted);
        self::assertSame(0, $result->attempted);
    }

    public function test_inserting_the_same_contribution_twice_stores_one_row(): void
    {
        $repository = SqliteContributionRepository::inMemory();
        $contribution = $this->review('dup-url', 5, '2020-01-01');

        $first = $repository->insertMany([$contribution]);
        $second = $repository->insertMany([$contribution]);

        self::assertSame(1, $first->inserted);
        self::assertSame(0, $second->inserted);
        self::assertSame(1, $second->duplicates);
        self::assertSame(1, $repository->count());
    }

    public function test_duplicates_within_a_single_batch_are_deduplicated(): void
    {
        $repository = SqliteContributionRepository::inMemory();
        $contribution = $this->review('dup-url', 5, '2020-01-01');

        $result = $repository->insertMany([$contribution, $contribution, $contribution]);

        self::assertSame(1, $result->inserted);
        self::assertSame(2, $result->duplicates);
        self::assertSame(3, $result->attempted);
        self::assertSame(1, $repository->count());
    }

    public function test_find_returns_a_stored_contribution(): void
    {
        $repository = SqliteContributionRepository::inMemory();
        $repository->insertMany([$this->review('u1', 5, '2020-01-01')]);

        $found = $repository->find(1);

        self::assertNotNull($found);
        self::assertSame('u1', $found->googleMapsUrl);
    }

    public function test_find_returns_null_for_a_missing_id(): void
    {
        self::assertNull(SqliteContributionRepository::inMemory()->find(999));
    }

    public function test_a_review_round_trips_through_storage_unchanged(): void
    {
        $repository = SqliteContributionRepository::inMemory();
        $original = Contribution::create(
            'Round Trip Cafe',
            '99 Test Avenue',
            51.5072178,
            -0.1275862,
            'https://maps/roundtrip',
            ContributionType::Review,
            4,
            'A genuinely lovely spot.',
            $this->utc('2022-08-09 14:25:36'),
            0,
        );
        $repository->insertMany([$original]);

        self::assertEquals($original, $repository->find(1));
    }

    public function test_a_photo_round_trips_through_storage_unchanged(): void
    {
        $repository = SqliteContributionRepository::inMemory();
        $original = Contribution::create(
            'aurora.jpg',
            '',
            64.1265432,
            -21.8174321,
            '',
            ContributionType::Photo,
            null,
            null,
            $this->utc('2021-01-02 03:04:05'),
            8123,
        );
        $repository->insertMany([$original]);

        self::assertEquals($original, $repository->find(1));
    }

    public function test_all_returns_contributions_newest_first(): void
    {
        $repository = SqliteContributionRepository::inMemory();
        $repository->insertMany([
            $this->review('u-mid', 4, '2020-06-15'),
            $this->review('u-new', 5, '2022-01-01'),
            $this->review('u-old', 3, '2018-03-03'),
        ]);

        $all = $repository->all();

        self::assertCount(3, $all);
        self::assertSame('u-new', $all[0]->googleMapsUrl);
        self::assertSame('u-mid', $all[1]->googleMapsUrl);
        self::assertSame('u-old', $all[2]->googleMapsUrl);
    }

    public function test_filter_by_type(): void
    {
        $repository = SqliteContributionRepository::inMemory();
        $repository->insertMany([
            $this->review('r1', 5, '2020-01-01'),
            $this->review('r2', 4, '2020-02-01'),
            $this->photo('p1.jpg', '2020-03-01'),
        ]);

        self::assertCount(2, $repository->all(['type' => ContributionType::Review]));
        self::assertCount(1, $repository->all(['type' => 'photo']));
    }

    public function test_filter_by_date_range(): void
    {
        $repository = SqliteContributionRepository::inMemory();
        $repository->insertMany([
            $this->review('r-2018', 5, '2018-05-05'),
            $this->review('r-2020', 4, '2020-05-05'),
            $this->review('r-2022', 3, '2022-05-05'),
        ]);

        self::assertCount(2, $repository->all(['date_from' => '2019-01-01']));
        self::assertCount(2, $repository->all(['date_to' => '2021-12-31']));
        self::assertCount(1, $repository->all([
            'date_from' => '2019-01-01',
            'date_to' => '2021-12-31',
        ]));
    }

    public function test_filter_by_search_text_is_case_insensitive(): void
    {
        $repository = SqliteContributionRepository::inMemory();
        $repository->insertMany([
            $this->review('r1', 5, '2020-01-01', 'Quiet Coffee Corner', 'Great espresso here.'),
            $this->review('r2', 4, '2020-02-01', 'Loud Sports Bar', 'Far too noisy.'),
        ]);

        self::assertCount(1, $repository->all(['search' => 'coffee']));
        self::assertCount(1, $repository->all(['search' => 'espresso']));
        self::assertCount(1, $repository->all(['search' => 'CORNER']));
        self::assertCount(0, $repository->all(['search' => 'nonexistent']));
    }

    public function test_search_escapes_like_wildcards(): void
    {
        $repository = SqliteContributionRepository::inMemory();
        $repository->insertMany([
            $this->review('r1', 5, '2020-01-01', '100% Arabica Roasters'),
            $this->review('r2', 4, '2020-02-01', '1000 Oaks Diner'),
            $this->review('r3', 3, '2020-03-01', 'Plain Tea House'),
        ]);

        // If "%" were not escaped, the LIKE pattern would also match
        // "1000 Oaks Diner" (it contains "100").
        $matches = $repository->all(['search' => '100%']);

        self::assertCount(1, $matches);
        self::assertSame('100% Arabica Roasters', $matches[0]->placeName);
    }

    public function test_limit_and_offset_paginate_results(): void
    {
        $repository = SqliteContributionRepository::inMemory();
        $repository->insertMany([
            $this->review('r1', 5, '2020-01-01'),
            $this->review('r2', 5, '2020-02-01'),
            $this->review('r3', 5, '2020-03-01'),
            $this->review('r4', 5, '2020-04-01'),
            $this->review('r5', 5, '2020-05-01'),
        ]);

        self::assertCount(2, $repository->all(['limit' => 2]));

        // Newest first: r5, r4 | r3, r2 | r1.
        $secondPage = $repository->all(['limit' => 2, 'offset' => 2]);
        self::assertCount(2, $secondPage);
        self::assertSame('r3', $secondPage[0]->googleMapsUrl);
    }

    public function test_stats_aggregates_total_average_and_date_bounds(): void
    {
        $repository = SqliteContributionRepository::inMemory();
        $repository->insertMany([
            $this->review('r1', 3, '2018-01-01'),
            $this->review('r2', 4, '2020-06-15'),
            $this->review('r3', 5, '2022-12-31'),
            $this->photo('p1.jpg', '2019-03-03'),
        ]);

        $stats = $repository->stats();

        self::assertSame(4, $stats->total);
        self::assertSame(3, $stats->countOf(ContributionType::Review));
        self::assertSame(1, $stats->countOf('photo'));
        self::assertSame(4.0, $stats->averageRating);
        self::assertSame('2018-01-01', $stats->earliestDate?->format('Y-m-d'));
        self::assertSame('2022-12-31', $stats->latestDate?->format('Y-m-d'));
    }

    public function test_stats_on_an_empty_store_returns_nulls(): void
    {
        $stats = SqliteContributionRepository::inMemory()->stats();

        self::assertSame(0, $stats->total);
        self::assertSame([], $stats->byType);
        self::assertNull($stats->averageRating);
        self::assertNull($stats->earliestDate);
        self::assertNull($stats->latestDate);
    }

    public function test_types_returns_per_type_counts(): void
    {
        $repository = SqliteContributionRepository::inMemory();
        $repository->insertMany([
            $this->review('r1', 5, '2020-01-01'),
            $this->review('r2', 4, '2020-02-01'),
            $this->review('r3', 3, '2020-03-01'),
            $this->photo('p1.jpg', '2020-04-01'),
        ]);

        self::assertSame(['photo' => 1, 'review' => 3], $repository->types());
    }

    public function test_truncate_empties_the_store(): void
    {
        $repository = SqliteContributionRepository::inMemory();
        $repository->insertMany([
            $this->review('r1', 5, '2020-01-01'),
            $this->review('r2', 4, '2020-02-01'),
        ]);
        self::assertSame(2, $repository->count());

        $repository->truncate();

        self::assertSame(0, $repository->count());
        self::assertSame([], $repository->all());
    }

    public function test_truncate_resets_the_autoincrement_counter(): void
    {
        $repository = SqliteContributionRepository::inMemory();
        $repository->insertMany([$this->review('r1', 5, '2020-01-01')]);
        $repository->truncate();
        $repository->insertMany([$this->review('r2', 4, '2021-01-01')]);

        $found = $repository->find(1);
        self::assertNotNull($found);
        self::assertSame('r2', $found->googleMapsUrl);
    }

    public function test_from_file_persists_data_across_connections(): void
    {
        $path = sys_get_temp_dir() . '/guidemap-store-' . uniqid('', true) . '.sqlite';

        try {
            $writer = SqliteContributionRepository::fromFile($path);
            $writer->insertMany([$this->review('persisted', 5, '2020-01-01')]);

            $reader = SqliteContributionRepository::fromFile($path);
            self::assertSame(1, $reader->count());
            self::assertNotNull($reader->find(1));
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }
}

<?php

declare(strict_types=1);

namespace GuideMap\Tests;

use DateTimeImmutable;
use DateTimeZone;
use GuideMap\Contribution;
use GuideMap\ContributionType;

final class ContributionTest extends TestCase
{
    private function utc(string $date): DateTimeImmutable
    {
        return new DateTimeImmutable($date, new DateTimeZone('UTC'));
    }

    public function test_create_rounds_coordinates_to_seven_decimal_places(): void
    {
        $contribution = Contribution::create(
            'Place',
            'Address',
            12.123456789,
            -98.987654321,
            'https://maps/x',
            ContributionType::Review,
            5,
            'text',
            $this->utc('2020-01-01'),
            0,
        );

        self::assertSame(round(12.123456789, 7), $contribution->lat);
        self::assertSame(round(-98.987654321, 7), $contribution->lng);
    }

    public function test_create_populates_the_hash(): void
    {
        $date = $this->utc('2021-06-15T10:00:00');
        $contribution = Contribution::create(
            'Place',
            'Address',
            1.0,
            2.0,
            'https://maps/x',
            ContributionType::Review,
            4,
            'text',
            $date,
            0,
        );

        $expected = Contribution::computeHash(
            ContributionType::Review,
            'https://maps/x',
            'Place',
            'text',
            $date,
        );
        self::assertSame($expected, $contribution->hash);
        self::assertSame(64, strlen($contribution->hash));
    }

    public function test_hash_is_stable_across_identical_inputs(): void
    {
        $date = $this->utc('2021-06-15T10:00:00');

        $first = Contribution::computeHash(ContributionType::Review, 'u', 'n', 't', $date);
        $second = Contribution::computeHash(ContributionType::Review, 'u', 'n', 't', $date);
        $third = Contribution::computeHash(ContributionType::Review, 'u', 'n', 't', $date);

        self::assertSame($first, $second);
        self::assertSame($second, $third);
    }

    public function test_review_hash_matches_the_documented_formula(): void
    {
        $date = $this->utc('2021-06-15T10:00:00');

        self::assertSame(
            hash('sha256', 'https://maps/x|2021-06-15|review'),
            Contribution::computeHash(ContributionType::Review, 'https://maps/x', 'Name', 'Body', $date),
        );
    }

    public function test_starred_hash_matches_the_documented_formula(): void
    {
        self::assertSame(
            hash('sha256', 'https://maps/x|starred'),
            Contribution::computeHash(
                ContributionType::Starred,
                'https://maps/x',
                'Name',
                null,
                $this->utc('2021-06-15'),
            ),
        );
    }

    public function test_photo_hash_matches_the_documented_formula(): void
    {
        $date = $this->utc('2021-06-15T10:00:00');

        self::assertSame(
            hash('sha256', 'photo-title.jpg|' . $date->getTimestamp() . '|photo'),
            Contribution::computeHash(ContributionType::Photo, '', 'photo-title.jpg', null, $date),
        );
    }

    public function test_question_hash_matches_the_documented_formula(): void
    {
        $date = $this->utc('2021-06-15');
        $text = 'Is there parking available nearby for visitors?';

        self::assertSame(
            hash('sha256', 'https://maps/x|' . mb_substr($text, 0, 50) . '|question'),
            Contribution::computeHash(ContributionType::Question, 'https://maps/x', 'Name', $text, $date),
        );
    }

    public function test_review_hash_ignores_place_name_and_review_text(): void
    {
        $date = $this->utc('2021-06-15');

        $a = Contribution::computeHash(ContributionType::Review, 'u', 'Name A', 'Body A', $date);
        $b = Contribution::computeHash(ContributionType::Review, 'u', 'Name B', 'Body B', $date);

        self::assertSame($a, $b);
    }

    public function test_review_hash_changes_with_url_or_date(): void
    {
        $date = $this->utc('2021-06-15');

        $base = Contribution::computeHash(ContributionType::Review, 'u1', 'n', 't', $date);
        $otherUrl = Contribution::computeHash(ContributionType::Review, 'u2', 'n', 't', $date);
        $otherDate = Contribution::computeHash(
            ContributionType::Review,
            'u1',
            'n',
            't',
            $this->utc('2021-06-16'),
        );

        self::assertNotSame($base, $otherUrl);
        self::assertNotSame($base, $otherDate);
    }

    public function test_each_type_produces_a_distinct_hash_namespace(): void
    {
        $date = $this->utc('2021-06-15');
        $hashes = [
            Contribution::computeHash(ContributionType::Review, 'u', 'n', 't', $date),
            Contribution::computeHash(ContributionType::Starred, 'u', 'n', 't', $date),
            Contribution::computeHash(ContributionType::Photo, 'u', 'n', 't', $date),
            Contribution::computeHash(ContributionType::Question, 'u', 'n', 't', $date),
        ];

        self::assertCount(4, array_unique($hashes), 'Every type should hash differently.');
    }

    public function test_question_hash_only_considers_the_first_fifty_text_characters(): void
    {
        $date = $this->utc('2021-06-15');
        $prefix = str_repeat('a', 50);

        $sameWithinFifty = Contribution::computeHash(
            ContributionType::Question,
            'u',
            'n',
            $prefix . 'TAIL-ONE',
            $date,
        );
        $alsoSameWithinFifty = Contribution::computeHash(
            ContributionType::Question,
            'u',
            'n',
            $prefix . 'TAIL-TWO',
            $date,
        );
        $differentWithinFifty = Contribution::computeHash(
            ContributionType::Question,
            'u',
            'n',
            str_repeat('b', 50),
            $date,
        );

        self::assertSame($sameWithinFifty, $alsoSameWithinFifty);
        self::assertNotSame($sameWithinFifty, $differentWithinFifty);
    }

    public function test_has_null_island_detects_zero_coordinates(): void
    {
        $atNullIsland = Contribution::create(
            'P',
            'A',
            0.0,
            0.0,
            'u',
            ContributionType::Starred,
            null,
            null,
            $this->utc('2020-01-01'),
            0,
        );
        $located = Contribution::create(
            'P',
            'A',
            51.5,
            -0.12,
            'u',
            ContributionType::Starred,
            null,
            null,
            $this->utc('2020-01-01'),
            0,
        );

        self::assertTrue($atNullIsland->hasNullIsland());
        self::assertFalse($located->hasNullIsland());
    }
}

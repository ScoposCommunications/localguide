<?php

declare(strict_types=1);

namespace GuideMap\Tests\Parser;

use GuideMap\Contribution;
use GuideMap\ContributionType;
use GuideMap\Parser\ReviewsParser;
use GuideMap\Tests\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

final class ReviewsParserTest extends TestCase
{
    /**
     * Parse a single review feature and return the one resulting contribution.
     *
     * @param array<string, mixed> $properties
     * @param array{0: float|int, 1: float|int} $coordinates
     */
    private function parseOne(array $properties, array $coordinates = [10.0, 20.0]): Contribution
    {
        $result = (new ReviewsParser())->parse([
            'type' => 'FeatureCollection',
            'features' => [[
                'type' => 'Feature',
                'geometry' => ['type' => 'Point', 'coordinates' => $coordinates],
                'properties' => $properties,
            ]],
        ]);

        self::assertCount(1, $result->contributions);

        return $result->contributions[0];
    }

    #[DataProvider('ratingFieldVariants')]
    public function test_rating_is_read_from_every_field_name_variant(string $field): void
    {
        $contribution = $this->parseOne([
            'name' => 'Place',
            'google_maps_url' => 'https://maps/x',
            'date' => '2020-01-01',
            'review_text' => 'A review.',
            $field => 5,
        ]);

        self::assertSame(5, $contribution->rating);
    }

    /** @return array<string, array{0: string}> */
    public static function ratingFieldVariants(): array
    {
        return [
            'five_star_rating_published' => ['five_star_rating_published'],
            'star_rating' => ['star_rating'],
            'Star Rating' => ['Star Rating'],
            'Star_Rating_Published' => ['Star_Rating_Published'],
            'stars' => ['stars'],
        ];
    }

    #[DataProvider('reviewTextFieldVariants')]
    public function test_review_text_is_read_from_every_field_name_variant(string $field): void
    {
        $contribution = $this->parseOne([
            'name' => 'Place',
            'google_maps_url' => 'https://maps/x',
            'date' => '2020-01-01',
            'star_rating' => 4,
            $field => 'The review body.',
        ]);

        self::assertSame('The review body.', $contribution->reviewText);
    }

    /** @return array<string, array{0: string}> */
    public static function reviewTextFieldVariants(): array
    {
        return [
            'review_text' => ['review_text'],
            'Review Text' => ['Review Text'],
            'Published_Review' => ['Published_Review'],
            'review_text_published' => ['review_text_published'],
            'comment' => ['comment'],
        ];
    }

    #[DataProvider('dateFieldVariants')]
    public function test_date_is_read_from_every_field_name_variant(string $field): void
    {
        $contribution = $this->parseOne([
            'name' => 'Place',
            'google_maps_url' => 'https://maps/x',
            'star_rating' => 4,
            'review_text' => 'A review.',
            $field => '2020-07-04',
        ]);

        self::assertSame('2020-07-04', $contribution->date->format('Y-m-d'));
    }

    /** @return array<string, array{0: string}> */
    public static function dateFieldVariants(): array
    {
        return [
            'published_date' => ['published_date'],
            'date' => ['date'],
            'Date' => ['Date'],
            'review_date' => ['review_date'],
        ];
    }

    public function test_place_name_is_read_from_nested_or_flat_location(): void
    {
        $nested = $this->parseOne([
            'location' => ['name' => 'Nested Cafe'],
            'google_maps_url' => 'https://maps/x',
            'date' => '2020-01-01',
            'star_rating' => 4,
        ]);
        $flat = $this->parseOne([
            'name' => 'Flat Cafe',
            'google_maps_url' => 'https://maps/x',
            'date' => '2020-01-01',
            'star_rating' => 4,
        ]);

        self::assertSame('Nested Cafe', $nested->placeName);
        self::assertSame('Flat Cafe', $flat->placeName);
    }

    public function test_modern_and_legacy_field_names_yield_an_identical_contribution(): void
    {
        $modern = (new ReviewsParser())->parse(['features' => [[
            'geometry' => ['coordinates' => [4.5, 6.7]],
            'properties' => [
                'location' => ['name' => 'Same Place', 'address' => 'Same Address'],
                'google_maps_url' => 'https://maps/same',
                'published_date' => '2020-05-05',
                'five_star_rating_published' => 4,
                'review_text_published' => 'Same review body.',
            ],
        ]]])->contributions;

        $legacy = (new ReviewsParser())->parse(['features' => [[
            'geometry' => ['coordinates' => [4.5, 6.7]],
            'properties' => [
                'name' => 'Same Place',
                'address' => 'Same Address',
                'url' => 'https://maps/same',
                'date' => '2020-05-05',
                'star_rating' => 4,
                'review_text' => 'Same review body.',
            ],
        ]]])->contributions;

        self::assertEquals($modern[0], $legacy[0]);
    }

    public function test_coordinates_come_from_geojson_geometry(): void
    {
        $contribution = $this->parseOne(
            ['name' => 'P', 'google_maps_url' => 'u', 'date' => '2020-01-01', 'star_rating' => 4],
            [-122.4194155, 37.7749295],
        );

        self::assertSame(37.7749295, $contribution->lat);
        self::assertSame(-122.4194155, $contribution->lng);
    }

    public function test_skips_entries_at_zero_coordinates(): void
    {
        $contributions = (new ReviewsParser())->parse(['features' => [
            [
                'geometry' => ['coordinates' => [0, 0]],
                'properties' => ['name' => 'Skip Me', 'google_maps_url' => 'u', 'date' => '2020-01-01', 'star_rating' => 3],
            ],
            [
                'geometry' => ['coordinates' => [1.0, 2.0]],
                'properties' => ['name' => 'Keep Me', 'google_maps_url' => 'u2', 'date' => '2020-01-01', 'star_rating' => 4],
            ],
        ]])->contributions;

        self::assertCount(1, $contributions);
        self::assertSame('Keep Me', $contributions[0]->placeName);
    }

    public function test_skips_a_record_with_no_parseable_date(): void
    {
        $result = (new ReviewsParser())->parse(['features' => [
            [
                'geometry' => ['coordinates' => [1.0, 2.0]],
                'properties' => [
                    'name' => 'Dateless Diner',
                    'google_maps_url' => 'https://maps/x',
                    'star_rating' => 4,
                    'review_text' => 'This record carries no date field at all.',
                ],
            ],
            [
                'geometry' => ['coordinates' => [3.0, 4.0]],
                'properties' => [
                    'name' => 'Dated Bistro',
                    'google_maps_url' => 'https://maps/y',
                    'date' => '2020-01-01',
                    'star_rating' => 5,
                    'review_text' => 'This one has a date.',
                ],
            ],
        ]]);

        self::assertCount(1, $result->contributions);
        self::assertSame('Dated Bistro', $result->contributions[0]->placeName);
        self::assertSame(
            ["Skipped review 'Dateless Diner' — no parseable date"],
            $result->errors,
        );
    }

    public function test_parses_a_reviews_wrapper_object(): void
    {
        $contributions = (new ReviewsParser())->parse(['reviews' => [[
            'name' => 'Wrapped', 'url' => 'u', 'date' => '2020-01-01',
            'star_rating' => 5, 'review_text' => 't', 'latitude' => 1.0, 'longitude' => 2.0,
        ]]])->contributions;

        self::assertCount(1, $contributions);
        self::assertSame('Wrapped', $contributions[0]->placeName);
    }

    public function test_parses_a_bare_list_of_reviews(): void
    {
        $contributions = (new ReviewsParser())->parse([[
            'name' => 'Listed', 'url' => 'u', 'date' => '2020-01-01',
            'star_rating' => 5, 'review_text' => 't', 'latitude' => 1.0, 'longitude' => 2.0,
        ]])->contributions;

        self::assertCount(1, $contributions);
        self::assertSame('Listed', $contributions[0]->placeName);
    }

    public function test_parses_a_single_flat_review_object(): void
    {
        $contributions = (new ReviewsParser())->parse([
            'name' => 'Flat Place',
            'url' => 'https://maps/flat',
            'date' => '2020-02-02',
            'star_rating' => 3,
            'review_text' => 'Flat review.',
            'latitude' => 40.0,
            'longitude' => -70.0,
        ])->contributions;

        self::assertCount(1, $contributions);
        self::assertSame('Flat Place', $contributions[0]->placeName);
        self::assertSame(40.0, $contributions[0]->lat);
        self::assertSame(-70.0, $contributions[0]->lng);
    }

    public function test_empty_input_yields_no_contributions(): void
    {
        self::assertSame([], (new ReviewsParser())->parse([])->contributions);
        self::assertSame([], (new ReviewsParser())->parse(['features' => []])->contributions);
    }

    public function test_parses_the_reviews_fixture(): void
    {
        $contributions = (new ReviewsParser())->parse($this->fixture('reviews.json'))->contributions;

        // The fixture has 6 features; one sits at 0,0 and is skipped.
        self::assertCount(5, $contributions);
        foreach ($contributions as $contribution) {
            self::assertSame(ContributionType::Review, $contribution->type);
        }

        $byName = [];
        foreach ($contributions as $contribution) {
            $byName[$contribution->placeName] = $contribution;
        }

        self::assertArrayHasKey('Blue Bottle Coffee', $byName);
        self::assertSame(5, $byName['Blue Bottle Coffee']->rating);
        self::assertSame(37.7749295, $byName['Blue Bottle Coffee']->lat);
        self::assertSame('2017-06-30', $byName['Eiffel Tower']->date->format('Y-m-d'));
        self::assertArrayNotHasKey('Place With Stripped Coordinates', $byName);
    }
}

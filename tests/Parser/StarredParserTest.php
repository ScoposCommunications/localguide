<?php

declare(strict_types=1);

namespace GuideMap\Tests\Parser;

use GuideMap\Contribution;
use GuideMap\ContributionType;
use GuideMap\Parser\StarredParser;
use GuideMap\Tests\TestCase;

final class StarredParserTest extends TestCase
{
    /**
     * @param array<string, mixed> $properties
     * @param array{0: float|int, 1: float|int} $coordinates
     */
    private function parseOne(array $properties, array $coordinates = [10.0, 20.0]): Contribution
    {
        $result = (new StarredParser())->parse([
            'type' => 'FeatureCollection',
            'features' => [[
                'type' => 'Feature',
                'geometry' => ['type' => 'Point', 'coordinates' => $coordinates],
                'properties' => $properties,
            ]],
        ]);

        self::assertCount(1, $result);

        return $result[0];
    }

    public function test_starred_places_have_no_rating_or_review_text(): void
    {
        $contribution = $this->parseOne([
            'name' => 'A Place',
            'google_maps_url' => 'https://maps/x',
            'date' => '2020-01-01',
        ]);

        self::assertSame(ContributionType::Starred, $contribution->type);
        self::assertNull($contribution->rating);
        self::assertNull($contribution->reviewText);
    }

    public function test_place_name_is_read_from_nested_or_flat_location(): void
    {
        $nested = $this->parseOne([
            'location' => ['name' => 'Nested Place'],
            'google_maps_url' => 'https://maps/x',
        ]);
        $flat = $this->parseOne([
            'name' => 'Flat Place',
            'google_maps_url' => 'https://maps/x',
        ]);

        self::assertSame('Nested Place', $nested->placeName);
        self::assertSame('Flat Place', $flat->placeName);
    }

    public function test_fields_are_matched_case_insensitively(): void
    {
        $contribution = $this->parseOne([
            'Title' => 'Capitalized Place',
            'URL' => 'https://maps/caps',
            'Address' => '1 Capital Street',
        ]);

        self::assertSame('Capitalized Place', $contribution->placeName);
        self::assertSame('https://maps/caps', $contribution->googleMapsUrl);
        self::assertSame('1 Capital Street', $contribution->placeAddress);
    }

    public function test_skips_entries_at_zero_coordinates(): void
    {
        $result = (new StarredParser())->parse(['features' => [
            [
                'geometry' => ['coordinates' => [0, 0]],
                'properties' => ['name' => 'Skip Me', 'google_maps_url' => 'u'],
            ],
            [
                'geometry' => ['coordinates' => [3.0, 4.0]],
                'properties' => ['name' => 'Keep Me', 'google_maps_url' => 'u2'],
            ],
        ]]);

        self::assertCount(1, $result);
        self::assertSame('Keep Me', $result[0]->placeName);
    }

    public function test_parses_a_single_flat_starred_object(): void
    {
        $result = (new StarredParser())->parse([
            'name' => 'Solo Place',
            'url' => 'https://maps/solo',
            'latitude' => 48.8,
            'longitude' => 2.3,
        ]);

        self::assertCount(1, $result);
        self::assertSame('Solo Place', $result[0]->placeName);
        self::assertSame(48.8, $result[0]->lat);
    }

    public function test_parses_the_starred_fixture(): void
    {
        $result = (new StarredParser())->parse($this->fixture('starred.json'));

        self::assertCount(4, $result);

        $names = array_map(static fn (Contribution $c): string => $c->placeName, $result);
        foreach ($result as $contribution) {
            self::assertSame(ContributionType::Starred, $contribution->type);
        }

        self::assertContains('Googleplex', $names);
        self::assertContains('Colosseum', $names);
        self::assertContains('Mercado de San Miguel', $names);
        self::assertContains('Sydney Opera House', $names);
    }
}

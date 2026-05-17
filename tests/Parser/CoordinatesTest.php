<?php

declare(strict_types=1);

namespace GuideMap\Tests\Parser;

use GuideMap\Parser\Coordinates;
use GuideMap\Tests\TestCase;

final class CoordinatesTest extends TestCase
{
    public function test_reads_geojson_coordinates_in_lng_lat_order(): void
    {
        // GeoJSON stores [longitude, latitude]; the result is [lat, lng].
        $record = ['geometry' => ['type' => 'Point', 'coordinates' => [139.7, 35.6]]];

        self::assertSame([35.6, 139.7], Coordinates::resolve($record, []));
    }

    public function test_reads_flat_latitude_and_longitude(): void
    {
        self::assertSame(
            [10.5, 20.5],
            Coordinates::resolve([], ['latitude' => 10.5, 'longitude' => 20.5]),
        );
    }

    public function test_reads_nested_location_coordinates(): void
    {
        self::assertSame(
            [1.1, 2.2],
            Coordinates::resolve([], ['location' => ['latitude' => 1.1, 'longitude' => 2.2]]),
        );
    }

    public function test_reads_geo_data_exif_coordinates(): void
    {
        self::assertSame(
            [53.3454289, -6.2634971],
            Coordinates::resolve([], ['geoDataExif' => ['latitude' => 53.3454289, 'longitude' => -6.2634971]]),
        );
    }

    public function test_accepts_numeric_string_coordinates(): void
    {
        $record = ['geometry' => ['coordinates' => ['139.7', '35.6']]];

        self::assertSame([35.6, 139.7], Coordinates::resolve($record, []));
    }

    public function test_returns_null_island_when_no_coordinates_are_present(): void
    {
        self::assertSame([0.0, 0.0], Coordinates::resolve([], ['name' => 'No location here']));
    }

    public function test_geojson_takes_precedence_over_flat_keys(): void
    {
        $record = ['geometry' => ['coordinates' => [1.0, 2.0]]];
        $props = ['latitude' => 99.0, 'longitude' => 88.0];

        self::assertSame([2.0, 1.0], Coordinates::resolve($record, $props));
    }
}

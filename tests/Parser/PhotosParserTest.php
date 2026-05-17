<?php

declare(strict_types=1);

namespace GuideMap\Tests\Parser;

use GuideMap\Contribution;
use GuideMap\ContributionType;
use GuideMap\Parser\PhotosParser;
use GuideMap\Tests\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

final class PhotosParserTest extends TestCase
{
    /**
     * @param array<string, mixed> $photo
     */
    private function parseOne(array $photo): Contribution
    {
        $result = (new PhotosParser())->parse(['photos' => [$photo]]);

        self::assertCount(1, $result);

        return $result[0];
    }

    public function test_photo_title_becomes_the_place_name(): void
    {
        $contribution = $this->parseOne([
            'title' => 'sunset_over_the_bay.jpg',
            'imageViews' => '120',
            'photoTakenTime' => ['timestamp' => '1592234100'],
            'geoDataExif' => ['latitude' => 1.0, 'longitude' => 2.0],
        ]);

        self::assertSame(ContributionType::Photo, $contribution->type);
        self::assertSame('sunset_over_the_bay.jpg', $contribution->placeName);
        self::assertNull($contribution->rating);
    }

    #[DataProvider('viewCountVariants')]
    public function test_view_count_is_read_from_every_field_name_variant(string $field): void
    {
        $contribution = $this->parseOne([
            'title' => 'photo.jpg',
            $field => 4096,
            'photoTakenTime' => ['timestamp' => '1592234100'],
            'geoDataExif' => ['latitude' => 1.0, 'longitude' => 2.0],
        ]);

        self::assertSame(4096, $contribution->photoViews);
    }

    /** @return array<string, array{0: string}> */
    public static function viewCountVariants(): array
    {
        return [
            'imageViews' => ['imageViews'],
            'view_count' => ['view_count'],
            'views' => ['views'],
        ];
    }

    public function test_date_is_read_from_photo_taken_time(): void
    {
        $contribution = $this->parseOne([
            'title' => 'photo.jpg',
            'photoTakenTime' => ['timestamp' => '1592234100'],
            'geoDataExif' => ['latitude' => 1.0, 'longitude' => 2.0],
        ]);

        self::assertSame('2020-06-15', $contribution->date->format('Y-m-d'));
    }

    public function test_date_falls_back_to_creation_time(): void
    {
        $contribution = $this->parseOne([
            'title' => 'photo.jpg',
            'creationTime' => ['timestamp' => '1680134400'],
            'geoDataExif' => ['latitude' => 1.0, 'longitude' => 2.0],
        ]);

        self::assertSame('2023-03-30', $contribution->date->format('Y-m-d'));
    }

    public function test_date_can_come_from_a_top_level_date_field(): void
    {
        $contribution = $this->parseOne([
            'title' => 'photo.jpg',
            'date' => '2024-12-24',
            'geoDataExif' => ['latitude' => 1.0, 'longitude' => 2.0],
        ]);

        self::assertSame('2024-12-24', $contribution->date->format('Y-m-d'));
    }

    public function test_coordinates_are_read_from_geo_data_exif(): void
    {
        $contribution = $this->parseOne([
            'title' => 'photo.jpg',
            'photoTakenTime' => ['timestamp' => '1592234100'],
            'geoDataExif' => ['latitude' => 53.3454289, 'longitude' => -6.2634971],
        ]);

        self::assertSame(53.3454289, $contribution->lat);
        self::assertSame(-6.2634971, $contribution->lng);
    }

    public function test_coordinates_fall_back_to_geo_data(): void
    {
        $contribution = $this->parseOne([
            'title' => 'photo.jpg',
            'photoTakenTime' => ['timestamp' => '1592234100'],
            'geoData' => ['latitude' => 35.0170, 'longitude' => 135.6711],
        ]);

        self::assertSame(35.017, $contribution->lat);
        self::assertSame(135.6711, $contribution->lng);
    }

    public function test_skips_photos_without_coordinates(): void
    {
        $result = (new PhotosParser())->parse(['photos' => [
            [
                'title' => 'no-location.jpg',
                'imageViews' => '5',
                'photoTakenTime' => ['timestamp' => '1592234100'],
            ],
            [
                'title' => 'located.jpg',
                'imageViews' => '9',
                'photoTakenTime' => ['timestamp' => '1592234100'],
                'geoDataExif' => ['latitude' => 1.0, 'longitude' => 2.0],
            ],
        ]]);

        self::assertCount(1, $result);
        self::assertSame('located.jpg', $result[0]->placeName);
    }

    public function test_parses_a_bare_list_of_photos(): void
    {
        $result = (new PhotosParser())->parse([[
            'title' => 'listed.jpg',
            'imageViews' => '7',
            'photoTakenTime' => ['timestamp' => '1592234100'],
            'geoDataExif' => ['latitude' => 1.0, 'longitude' => 2.0],
        ]]);

        self::assertCount(1, $result);
        self::assertSame('listed.jpg', $result[0]->placeName);
    }

    public function test_parses_the_photos_fixture(): void
    {
        $result = (new PhotosParser())->parse($this->fixture('photos.json'));

        self::assertCount(4, $result);

        $byTitle = [];
        foreach ($result as $contribution) {
            self::assertSame(ContributionType::Photo, $contribution->type);
            $byTitle[$contribution->placeName] = $contribution;
        }

        self::assertSame(2480, $byTitle['PXL_20200615_temple_bar.jpg']->photoViews);
        self::assertSame(56000, $byTitle['reykjavik_northern_lights.jpg']->photoViews);
        // This photo carries only geoData (no geoDataExif) — the fallback path.
        self::assertSame(35.017, $byTitle['kyoto_bamboo_grove.jpg']->lat);
    }
}

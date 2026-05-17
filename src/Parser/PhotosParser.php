<?php

declare(strict_types=1);

namespace GuideMap\Parser;

use GuideMap\Contribution;
use GuideMap\ContributionType;

/**
 * Parses Google Takeout photo metadata into {@see Contribution} objects.
 *
 * Photo records follow the Google Photos export shape: a `title`, an
 * `imageViews` count, a `photoTakenTime`/`creationTime` block, and a
 * `geoDataExif` block holding `latitude`/`longitude`. Accepts a
 * `{"photos": [...]}` wrapper, a bare list, or a single photo object.
 *
 * The photo's `title` is stored as the contribution's place name — it is the
 * field the photo deduplication hash is built from. A record at 0,0 is skipped
 * silently; a record with no parseable date is skipped with an error recorded
 * in the {@see TypeParseResult} (DECISIONS.md D14).
 */
final class PhotosParser
{
    /** @var list<string> */
    private const TITLE_KEYS = ['title', 'name', 'filename', 'photo_title', 'caption'];

    /** @var list<string> */
    private const VIEW_KEYS = [
        'imageViews',
        'image_views',
        'view_count',
        'views',
        'photo_views',
        'viewCount',
    ];

    /** @var list<string> */
    private const DATE_KEYS = [
        'photoTakenTime.timestamp',
        'photoTakenTime.formatted',
        'creationTime.timestamp',
        'creationTime.formatted',
        'photo_taken_time',
        'creation_time',
        'date',
        'timestamp',
    ];

    /** @var list<string> */
    private const URL_KEYS = ['google_maps_url', 'url', 'productUrl', 'maps_url'];

    /** @var list<string> */
    private const ADDRESS_KEYS = [
        'place_address',
        'address',
        'location.address',
        'description',
    ];

    /**
     * @param array<string, mixed> $data decoded JSON of one Photos file
     */
    public function parse(array $data): TypeParseResult
    {
        $contributions = [];
        $errors = [];

        foreach ($this->records($data) as $record) {
            [$lat, $lng] = Coordinates::resolve($record, $record);
            if ($lat === 0.0 && $lng === 0.0) {
                continue;
            }

            $title = PropertyFinder::findString($record, self::TITLE_KEYS) ?? '';
            $date = DateParser::tryParse(PropertyFinder::find($record, self::DATE_KEYS));
            if ($date === null) {
                $errors[] = sprintf(
                    "Skipped %s '%s' — no parseable date",
                    ContributionType::Photo->value,
                    $title,
                );
                continue;
            }

            $contributions[] = Contribution::create(
                placeName: $title,
                placeAddress: PropertyFinder::findString($record, self::ADDRESS_KEYS) ?? '',
                lat: $lat,
                lng: $lng,
                googleMapsUrl: PropertyFinder::findString($record, self::URL_KEYS) ?? '',
                type: ContributionType::Photo,
                rating: null,
                reviewText: null,
                date: $date,
                photoViews: PropertyFinder::findInt($record, self::VIEW_KEYS) ?? 0,
            );
        }

        return new TypeParseResult($contributions, $errors);
    }

    /**
     * Unwrap the file into a flat list of record arrays.
     *
     * @param array<string, mixed> $data
     *
     * @return list<array<string, mixed>>
     */
    private function records(array $data): array
    {
        foreach (['photos', 'mediaItems', 'items'] as $key) {
            if (isset($data[$key]) && is_array($data[$key])) {
                return array_values(array_filter($data[$key], 'is_array'));
            }
        }

        return array_is_list($data)
            ? array_values(array_filter($data, 'is_array'))
            : [$data];
    }
}

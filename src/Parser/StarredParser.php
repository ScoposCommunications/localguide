<?php

declare(strict_types=1);

namespace GuideMap\Parser;

use GuideMap\Contribution;
use GuideMap\ContributionType;

/**
 * Parses Google Takeout "Starred places" / "Saved places" data into
 * {@see Contribution} objects.
 *
 * This file is GeoJSON: a `FeatureCollection` whose features carry a place
 * name, address and URL but no rating or review text. Bare lists and
 * single-object inputs are also accepted.
 */
final class StarredParser
{
    /** @var list<string> */
    private const NAME_KEYS = ['location.name', 'name', 'place_name', 'title', 'Title'];

    /** @var list<string> */
    private const ADDRESS_KEYS = [
        'location.address',
        'address',
        'place_address',
        'formatted_address',
        'Address',
    ];

    /** @var list<string> */
    private const URL_KEYS = [
        'google_maps_url',
        'googleMapsUrl',
        'maps_url',
        'url',
        'URL',
        'place_url',
    ];

    /** @var list<string> */
    private const DATE_KEYS = ['date', 'Date', 'published_date', 'saved_date', 'created'];

    /**
     * @param array<string, mixed> $data decoded JSON of one Starred file
     *
     * @return list<Contribution>
     */
    public function parse(array $data): array
    {
        $contributions = [];
        foreach ($this->records($data) as $record) {
            $contribution = $this->toContribution($record);
            if ($contribution !== null) {
                $contributions[] = $contribution;
            }
        }

        return $contributions;
    }

    /**
     * @param array<string, mixed> $record
     */
    private function toContribution(array $record): ?Contribution
    {
        $props = (isset($record['properties']) && is_array($record['properties']))
            ? $record['properties']
            : $record;

        [$lat, $lng] = Coordinates::resolve($record, $props);
        if ($lat === 0.0 && $lng === 0.0) {
            return null;
        }

        return Contribution::create(
            placeName: PropertyFinder::findString($props, self::NAME_KEYS) ?? '',
            placeAddress: PropertyFinder::findString($props, self::ADDRESS_KEYS) ?? '',
            lat: $lat,
            lng: $lng,
            googleMapsUrl: PropertyFinder::findString($props, self::URL_KEYS) ?? '',
            type: ContributionType::Starred,
            rating: null,
            reviewText: null,
            date: DateParser::parse(PropertyFinder::find($props, self::DATE_KEYS)),
            photoViews: 0,
        );
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
        foreach (['features', 'starred', 'saved', 'places'] as $key) {
            if (isset($data[$key]) && is_array($data[$key])) {
                return array_values(array_filter($data[$key], 'is_array'));
            }
        }

        return array_is_list($data)
            ? array_values(array_filter($data, 'is_array'))
            : [$data];
    }
}

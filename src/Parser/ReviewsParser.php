<?php

declare(strict_types=1);

namespace GuideMap\Parser;

use GuideMap\Contribution;
use GuideMap\ContributionType;

/**
 * Parses Google Takeout "Reviews" data into {@see Contribution} objects.
 *
 * Accepts the GeoJSON `FeatureCollection` shape Takeout normally emits, a
 * `{"reviews": [...]}` wrapper, a bare list of review objects, or a single
 * review object. The many field-name spellings Takeout uses are listed as
 * candidate keys and resolved by {@see PropertyFinder}.
 */
final class ReviewsParser
{
    /** @var list<string> */
    private const RATING_KEYS = [
        'five_star_rating_published',
        'star_rating',
        'Star Rating',
        'Star_Rating_Published',
        'stars',
        'rating',
    ];

    /** @var list<string> */
    private const TEXT_KEYS = [
        'review_text_published',
        'review_text',
        'Review Text',
        'Published_Review',
        'comment',
        'text',
    ];

    /** @var list<string> */
    private const DATE_KEYS = [
        'published_date',
        'review_date',
        'date',
        'Date',
        'published',
    ];

    /** @var list<string> */
    private const NAME_KEYS = ['location.name', 'name', 'place_name', 'title'];

    /** @var list<string> */
    private const ADDRESS_KEYS = [
        'location.address',
        'address',
        'place_address',
        'formatted_address',
    ];

    /** @var list<string> */
    private const URL_KEYS = [
        'google_maps_url',
        'googleMapsUrl',
        'maps_url',
        'url',
        'place_url',
    ];

    /**
     * @param array<string, mixed> $data decoded JSON of one Reviews file
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
            type: ContributionType::Review,
            rating: PropertyFinder::findInt($props, self::RATING_KEYS),
            reviewText: PropertyFinder::findString($props, self::TEXT_KEYS),
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
        foreach (['features', 'reviews'] as $key) {
            if (isset($data[$key]) && is_array($data[$key])) {
                return array_values(array_filter($data[$key], 'is_array'));
            }
        }

        return array_is_list($data)
            ? array_values(array_filter($data, 'is_array'))
            : [$data];
    }
}

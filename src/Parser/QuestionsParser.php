<?php

declare(strict_types=1);

namespace GuideMap\Parser;

use GuideMap\Contribution;
use GuideMap\ContributionType;

/**
 * Parses Google Takeout "Questions" data into {@see Contribution} objects.
 *
 * A question record names the place it was asked about (name, address, URL)
 * and carries the question text, which is stored in the contribution's
 * `reviewText` field. Accepts a `{"questions": [...]}` wrapper, a GeoJSON
 * `FeatureCollection`, a bare list, or a single question object.
 *
 * A record at 0,0 is skipped silently; a record with no parseable date is
 * skipped with an error recorded in the {@see TypeParseResult} (DECISIONS.md
 * D14). See also the geocoding open question in ARCHITECTURE.md.
 */
final class QuestionsParser
{
    /** @var list<string> */
    private const TEXT_KEYS = [
        'question_text',
        'Question Text',
        'question',
        'Published_Question',
        'text',
        'body',
    ];

    /** @var list<string> */
    private const NAME_KEYS = ['place_name', 'location.name', 'name', 'title'];

    /** @var list<string> */
    private const ADDRESS_KEYS = [
        'place_address',
        'location.address',
        'address',
        'formatted_address',
    ];

    /** @var list<string> */
    private const URL_KEYS = [
        'place_url',
        'placeUrl',
        'google_maps_url',
        'googleMapsUrl',
        'maps_url',
        'url',
    ];

    /** @var list<string> */
    private const DATE_KEYS = [
        'date',
        'published_date',
        'asked_date',
        'question_date',
        'created',
        'timestamp',
    ];

    /**
     * @param array<string, mixed> $data decoded JSON of one Questions file
     */
    public function parse(array $data): TypeParseResult
    {
        $contributions = [];
        $errors = [];

        foreach ($this->records($data) as $record) {
            $props = (isset($record['properties']) && is_array($record['properties']))
                ? $record['properties']
                : $record;

            [$lat, $lng] = Coordinates::resolve($record, $props);
            if ($lat === 0.0 && $lng === 0.0) {
                continue;
            }

            $placeName = PropertyFinder::findString($props, self::NAME_KEYS) ?? '';
            $date = DateParser::tryParse(PropertyFinder::find($props, self::DATE_KEYS));
            if ($date === null) {
                $errors[] = sprintf(
                    "Skipped %s '%s' — no parseable date",
                    ContributionType::Question->value,
                    $placeName,
                );
                continue;
            }

            $contributions[] = Contribution::create(
                placeName: $placeName,
                placeAddress: PropertyFinder::findString($props, self::ADDRESS_KEYS) ?? '',
                lat: $lat,
                lng: $lng,
                googleMapsUrl: PropertyFinder::findString($props, self::URL_KEYS) ?? '',
                type: ContributionType::Question,
                rating: null,
                reviewText: PropertyFinder::findString($props, self::TEXT_KEYS),
                date: $date,
                photoViews: 0,
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
        foreach (['questions', 'features', 'items'] as $key) {
            if (isset($data[$key]) && is_array($data[$key])) {
                return array_values(array_filter($data[$key], 'is_array'));
            }
        }

        return array_is_list($data)
            ? array_values(array_filter($data, 'is_array'))
            : [$data];
    }
}

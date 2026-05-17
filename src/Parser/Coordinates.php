<?php

declare(strict_types=1);

namespace GuideMap\Parser;

/**
 * Resolves a latitude/longitude pair out of a Takeout record.
 *
 * Centralized deliberately: GeoJSON stores coordinates as `[longitude,
 * latitude]` — longitude first — which is the opposite of how they are
 * usually spoken and easy to transpose. Keeping that one subtle ordering rule
 * in a single place stops every parser from re-implementing (and potentially
 * mis-ordering) it.
 */
final class Coordinates
{
    /** @var list<string> */
    private const LAT_KEYS = [
        'latitude',
        'lat',
        'location.latitude',
        'location.lat',
        'geoDataExif.latitude',
        'geoData.latitude',
    ];

    /** @var list<string> */
    private const LNG_KEYS = [
        'longitude',
        'lng',
        'lon',
        'location.longitude',
        'location.lng',
        'geoDataExif.longitude',
        'geoData.longitude',
    ];

    /**
     * Resolve `[latitude, longitude]` for a record.
     *
     * Checks GeoJSON `geometry.coordinates` first (remembering it is
     * `[lng, lat]`), then falls back to the assorted flat/nested latitude and
     * longitude field names. Returns `[0.0, 0.0]` when no location is present
     * — the caller treats that "Null Island" pair as a row to skip.
     *
     * @param array<string, mixed> $record full record (may carry `geometry`)
     * @param array<string, mixed> $props  property bag to search for flat keys
     *
     * @return array{0: float, 1: float}
     */
    public static function resolve(array $record, array $props): array
    {
        $geo = PropertyFinder::find($record, ['geometry.coordinates']);
        if (
            is_array($geo)
            && isset($geo[0], $geo[1])
            && is_numeric($geo[0])
            && is_numeric($geo[1])
        ) {
            return [(float) $geo[1], (float) $geo[0]];
        }

        $lat = PropertyFinder::findFloat($props, self::LAT_KEYS);
        $lng = PropertyFinder::findFloat($props, self::LNG_KEYS);

        return [$lat ?? 0.0, $lng ?? 0.0];
    }
}

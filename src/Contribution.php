<?php

declare(strict_types=1);

namespace GuideMap;

use DateTimeImmutable;

/**
 * A single Google Maps contribution, normalized into one canonical shape
 * regardless of which Takeout file (and which field-name spelling) it came
 * from.
 *
 * This is an immutable value object. Parsers build instances with
 * {@see Contribution::create()}, which rounds coordinates and computes the
 * deduplication {@see Contribution::$hash}. The all-args constructor is used
 * directly only when rehydrating a row from storage, where the hash is
 * already known.
 */
final readonly class Contribution
{
    /**
     * Decimal places kept for latitude/longitude. 7 places is ~11 mm of
     * ground precision and matches what Google Takeout emits. See DECISIONS.md
     * (D6).
     */
    public const COORDINATE_PRECISION = 7;

    public function __construct(
        public string $placeName,
        public string $placeAddress,
        public float $lat,
        public float $lng,
        public string $googleMapsUrl,
        public ContributionType $type,
        public ?int $rating,
        public ?string $reviewText,
        public DateTimeImmutable $date,
        public int $photoViews,
        public string $hash,
    ) {
    }

    /**
     * Build a contribution from normalized fields. Rounds coordinates to
     * {@see Contribution::COORDINATE_PRECISION} and derives the dedup hash, so
     * a value object can never exist with a stale or missing hash.
     */
    public static function create(
        string $placeName,
        string $placeAddress,
        float $lat,
        float $lng,
        string $googleMapsUrl,
        ContributionType $type,
        ?int $rating,
        ?string $reviewText,
        DateTimeImmutable $date,
        int $photoViews,
    ): self {
        $lat = round($lat, self::COORDINATE_PRECISION);
        $lng = round($lng, self::COORDINATE_PRECISION);

        return new self(
            placeName: $placeName,
            placeAddress: $placeAddress,
            lat: $lat,
            lng: $lng,
            googleMapsUrl: $googleMapsUrl,
            type: $type,
            rating: $rating,
            reviewText: $reviewText,
            date: $date,
            photoViews: $photoViews,
            hash: self::computeHash($type, $googleMapsUrl, $placeName, $reviewText, $date),
        );
    }

    /**
     * Compute the SHA-256 deduplication hash for a contribution.
     *
     * The hashed payload differs per type so that re-importing the same
     * export is idempotent; see DECISIONS.md (D4) for the rationale behind
     * each field choice. Exposed as a public static method so tests can
     * assert hash stability without constructing a full value object.
     */
    public static function computeHash(
        ContributionType $type,
        string $googleMapsUrl,
        string $placeName,
        ?string $reviewText,
        DateTimeImmutable $date,
    ): string {
        $payload = match ($type) {
            ContributionType::Review =>
                $googleMapsUrl . '|' . $date->format('Y-m-d') . '|review',
            ContributionType::Starred =>
                $googleMapsUrl . '|starred',
            ContributionType::Photo =>
                $placeName . '|' . $date->getTimestamp() . '|photo',
            ContributionType::Question =>
                $googleMapsUrl . '|' . mb_substr($reviewText ?? '', 0, 50) . '|question',
        };

        return hash('sha256', $payload);
    }

    /**
     * True when the contribution has no real location (Takeout emits 0,0 for
     * records whose coordinates were stripped). Such rows are dropped by the
     * parsers before they ever reach storage.
     */
    public function hasNullIsland(): bool
    {
        return $this->lat === 0.0 && $this->lng === 0.0;
    }
}

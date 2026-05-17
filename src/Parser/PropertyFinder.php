<?php

declare(strict_types=1);

namespace GuideMap\Parser;

/**
 * Resolves a value out of a decoded-JSON array when its key could be spelled
 * several different ways.
 *
 * Google Takeout is wildly inconsistent: the same field appears as
 * `star_rating`, `Star Rating`, `five_star_rating_published`, and more across
 * exports and locales. {@see PropertyFinder::find()} is given the list of
 * spellings to try and returns the first value it can resolve.
 *
 * Two lookup features:
 *  - case-insensitive key matching (`Star Rating` matches `star rating`);
 *  - dot-notation path traversal (`location.name` descends into nested arrays).
 *
 * A key whose value is `null`, and a key that is absent, are treated
 * identically: both mean "not found here, try the next candidate."
 */
final class PropertyFinder
{
    /**
     * Return the first resolvable, non-null value among the candidate keys.
     *
     * @param array<string, mixed> $data         decoded JSON object
     * @param list<string>         $possibleKeys candidate keys, each plain or
     *                                           dot-notation, tried in order
     */
    public static function find(array $data, array $possibleKeys): mixed
    {
        foreach ($possibleKeys as $key) {
            $value = self::resolvePath($data, $key);
            if ($value !== null) {
                return $value;
            }
        }

        return null;
    }

    /**
     * Convenience wrapper: resolve a value and cast it to a trimmed string.
     * Returns null when the value is absent or resolves to an empty string.
     *
     * @param array<string, mixed> $data
     * @param list<string>         $possibleKeys
     */
    public static function findString(array $data, array $possibleKeys): ?string
    {
        $value = self::find($data, $possibleKeys);
        if ($value === null || is_array($value)) {
            return null;
        }

        $string = trim((string) (is_bool($value) ? (int) $value : $value));

        return $string === '' ? null : $string;
    }

    /**
     * Convenience wrapper: resolve a value and cast it to a float, accepting
     * numeric strings (Takeout frequently quotes numbers). Returns null when
     * the value is absent or not numeric.
     *
     * @param array<string, mixed> $data
     * @param list<string>         $possibleKeys
     */
    public static function findFloat(array $data, array $possibleKeys): ?float
    {
        $value = self::find($data, $possibleKeys);
        if (is_int($value) || is_float($value)) {
            return (float) $value;
        }
        if (is_string($value) && is_numeric(trim($value))) {
            return (float) trim($value);
        }

        return null;
    }

    /**
     * Convenience wrapper: resolve a value and cast it to an int, accepting
     * numeric strings. Returns null when the value is absent or not numeric.
     *
     * @param array<string, mixed> $data
     * @param list<string>         $possibleKeys
     */
    public static function findInt(array $data, array $possibleKeys): ?int
    {
        $value = self::find($data, $possibleKeys);
        if (is_int($value)) {
            return $value;
        }
        if (is_float($value)) {
            return (int) $value;
        }
        if (is_string($value) && is_numeric(trim($value))) {
            return (int) (float) trim($value);
        }

        return null;
    }

    /**
     * Walk a (possibly dot-notation) key path. Returns null on the first
     * missing or non-array segment.
     *
     * @param array<string, mixed> $data
     */
    private static function resolvePath(array $data, string $path): mixed
    {
        $current = $data;
        foreach (explode('.', $path) as $segment) {
            if (!is_array($current)) {
                return null;
            }
            $current = self::matchKey($current, $segment);
            if ($current === null) {
                return null;
            }
        }

        return $current;
    }

    /**
     * Look a single key up in one array level: exact match first, then a
     * case-insensitive scan.
     *
     * @param array<string, mixed> $data
     */
    private static function matchKey(array $data, string $key): mixed
    {
        if (array_key_exists($key, $data)) {
            return $data[$key];
        }

        $needle = strtolower($key);
        foreach ($data as $candidate => $value) {
            if (is_string($candidate) && strtolower($candidate) === $needle) {
                return $value;
            }
        }

        return null;
    }
}

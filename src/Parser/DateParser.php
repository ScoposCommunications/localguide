<?php

declare(strict_types=1);

namespace GuideMap\Parser;

use DateTimeImmutable;
use DateTimeZone;
use Exception;

/**
 * Coerces the assorted date representations Google Takeout emits into a single
 * UTC {@see DateTimeImmutable}.
 *
 * Takeout dates show up as ISO-8601 strings (with or without a timezone),
 * bare `Y-m-d` strings, and Unix timestamps in seconds or milliseconds — often
 * quoted as strings.
 *
 * Two entry points:
 *  - {@see tryParse()} returns null when the value cannot be parsed. The type
 *    parsers use this and skip date-less records rather than inventing a date
 *    (see DECISIONS.md D14).
 *  - {@see parse()} is the lenient variant: it falls back to the Unix epoch
 *    instead of returning null, for callers that need a guaranteed date.
 */
final class DateParser
{
    /** The "no usable date" sentinel: 1970-01-01T00:00:00+00:00. */
    public static function epoch(): DateTimeImmutable
    {
        return new DateTimeImmutable('@0');
    }

    /**
     * Normalize a Takeout date value to a UTC DateTimeImmutable, or return
     * null when the value is absent, empty, or unparseable.
     */
    public static function tryParse(mixed $value): ?DateTimeImmutable
    {
        if ($value instanceof DateTimeImmutable) {
            return $value->setTimezone(new DateTimeZone('UTC'));
        }

        if (is_int($value) || is_float($value)) {
            return self::fromTimestamp((int) $value);
        }

        if (is_string($value)) {
            $value = trim($value);
            if ($value === '') {
                return null;
            }
            if (self::looksLikeTimestamp($value)) {
                return self::fromTimestamp((int) $value);
            }

            return self::fromString($value);
        }

        return null;
    }

    /**
     * Lenient variant of {@see tryParse()}: returns the Unix epoch instead of
     * null when the value cannot be parsed.
     */
    public static function parse(mixed $value): DateTimeImmutable
    {
        return self::tryParse($value) ?? self::epoch();
    }

    /**
     * A purely numeric string of 9–14 digits is treated as a Unix timestamp.
     * Shorter values (e.g. a bare "2023") are left for textual parsing.
     */
    private static function looksLikeTimestamp(string $value): bool
    {
        $length = strlen($value);

        return ctype_digit($value) && $length >= 9 && $length <= 14;
    }

    /**
     * Build a UTC date from a Unix timestamp. 13+ digit values are treated as
     * milliseconds and divided down to seconds.
     */
    private static function fromTimestamp(int $timestamp): DateTimeImmutable
    {
        if ($timestamp >= 1_000_000_000_000) {
            $timestamp = intdiv($timestamp, 1000);
        }

        return new DateTimeImmutable('@' . $timestamp);
    }

    /**
     * Parse a textual date, normalized to UTC. Tries the lenient
     * DateTimeImmutable constructor first, then a short list of explicit
     * formats. Returns null when nothing matches cleanly.
     */
    private static function fromString(string $value): ?DateTimeImmutable
    {
        $utc = new DateTimeZone('UTC');

        try {
            return (new DateTimeImmutable($value, $utc))->setTimezone($utc);
        } catch (Exception) {
            // Not constructor-parseable; try explicit formats below.
        }

        foreach (['Y-m-d', 'Y/m/d', 'm/d/Y', 'd-m-Y', 'F j, Y', 'M j, Y'] as $format) {
            $parsed = DateTimeImmutable::createFromFormat('!' . $format, $value, $utc);
            $errors = DateTimeImmutable::getLastErrors();
            $clean = $errors === false
                || ($errors['warning_count'] === 0 && $errors['error_count'] === 0);
            if ($parsed instanceof DateTimeImmutable && $clean) {
                return $parsed;
            }
        }

        return null;
    }
}

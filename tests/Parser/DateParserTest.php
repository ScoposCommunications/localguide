<?php

declare(strict_types=1);

namespace GuideMap\Tests\Parser;

use DateTimeImmutable;
use DateTimeZone;
use GuideMap\Parser\DateParser;
use GuideMap\Tests\TestCase;

final class DateParserTest extends TestCase
{
    public function test_parses_iso_8601_with_zulu_timezone(): void
    {
        self::assertSame(
            '2021-03-22 08:30:00',
            DateParser::parse('2021-03-22T08:30:00Z')->format('Y-m-d H:i:s'),
        );
    }

    public function test_converts_an_offset_timezone_to_utc(): void
    {
        // 09:30 at +09:00 is 00:30 UTC.
        self::assertSame(
            '2023-11-02 00:30:00',
            DateParser::parse('2023-11-02T09:30:00+09:00')->format('Y-m-d H:i:s'),
        );
    }

    public function test_parses_a_bare_date(): void
    {
        self::assertSame(
            '2019-12-25 00:00:00',
            DateParser::parse('2019-12-25')->format('Y-m-d H:i:s'),
        );
    }

    public function test_parses_a_unix_timestamp_string(): void
    {
        self::assertSame(
            '2020-06-15 15:15:00',
            DateParser::parse('1592234100')->format('Y-m-d H:i:s'),
        );
    }

    public function test_parses_a_unix_timestamp_integer(): void
    {
        self::assertSame(
            '2020-06-15 15:15:00',
            DateParser::parse(1592234100)->format('Y-m-d H:i:s'),
        );
    }

    public function test_parses_a_millisecond_timestamp(): void
    {
        self::assertSame(
            '2020-06-15 15:15:00',
            DateParser::parse('1592234100000')->format('Y-m-d H:i:s'),
        );
    }

    public function test_parses_a_human_readable_date(): void
    {
        self::assertSame(
            '2023-06-15',
            DateParser::parse('June 15, 2023')->format('Y-m-d'),
        );
    }

    public function test_passes_through_a_datetime_immutable(): void
    {
        $input = new DateTimeImmutable('2020-01-01T12:00:00', new DateTimeZone('UTC'));

        self::assertSame($input->getTimestamp(), DateParser::parse($input)->getTimestamp());
    }

    public function test_null_normalizes_to_the_epoch(): void
    {
        self::assertSame(0, DateParser::parse(null)->getTimestamp());
    }

    public function test_empty_string_normalizes_to_the_epoch(): void
    {
        self::assertSame(0, DateParser::parse('')->getTimestamp());
    }

    public function test_unparseable_text_normalizes_to_the_epoch(): void
    {
        self::assertSame(0, DateParser::parse('xx-not-a-real-date-xx')->getTimestamp());
    }

    public function test_epoch_helper_is_the_unix_epoch(): void
    {
        self::assertSame(0, DateParser::epoch()->getTimestamp());
    }
}

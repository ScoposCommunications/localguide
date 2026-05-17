<?php

declare(strict_types=1);

namespace GuideMap\Tests\Clock;

use DateTimeImmutable;
use DateTimeZone;
use GuideMap\Clock\FrozenClock;
use GuideMap\Clock\SystemClock;
use GuideMap\Tests\TestCase;

final class ClockTest extends TestCase
{
    public function test_frozen_clock_returns_its_fixed_time(): void
    {
        $clock = FrozenClock::at('2026-05-17T12:00:00');

        self::assertSame('2026-05-17 12:00:00', $clock->now()->format('Y-m-d H:i:s'));
        self::assertSame('2026-05-17 12:00:00', $clock->now()->format('Y-m-d H:i:s'));
    }

    public function test_frozen_clock_can_be_advanced(): void
    {
        $clock = FrozenClock::at('2026-05-17T12:00:00');

        $clock->advance(3600);
        self::assertSame('2026-05-17 13:00:00', $clock->now()->format('Y-m-d H:i:s'));

        $clock->advance(-1800);
        self::assertSame('2026-05-17 12:30:00', $clock->now()->format('Y-m-d H:i:s'));
    }

    public function test_frozen_clock_can_be_set(): void
    {
        $clock = FrozenClock::at('2020-01-01T00:00:00');

        $clock->set(new DateTimeImmutable('2030-06-15T08:00:00', new DateTimeZone('UTC')));

        self::assertSame('2030-06-15', $clock->now()->format('Y-m-d'));
    }

    public function test_system_clock_reports_the_current_time_in_utc(): void
    {
        $before = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $now = (new SystemClock())->now();
        $after = new DateTimeImmutable('now', new DateTimeZone('UTC'));

        self::assertSame('UTC', $now->getTimezone()->getName());
        self::assertGreaterThanOrEqual($before->getTimestamp(), $now->getTimestamp());
        self::assertLessThanOrEqual($after->getTimestamp(), $now->getTimestamp());
    }
}

<?php

declare(strict_types=1);

namespace GuideMap\Clock;

use DateTimeImmutable;
use DateTimeZone;

/**
 * The production {@see Clock}: reports the real wall-clock time in UTC.
 */
final class SystemClock implements Clock
{
    public function now(): DateTimeImmutable
    {
        return new DateTimeImmutable('now', new DateTimeZone('UTC'));
    }
}

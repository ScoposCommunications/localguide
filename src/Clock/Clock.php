<?php

declare(strict_types=1);

namespace GuideMap\Clock;

use DateTimeImmutable;

/**
 * The current time, as a dependency.
 *
 * Injecting a clock — instead of calling `new DateTimeImmutable()` directly —
 * is what lets time-sensitive logic (notably OAuth token-expiry checks) be
 * tested deterministically with {@see FrozenClock}.
 */
interface Clock
{
    /**
     * The current moment, in UTC.
     */
    public function now(): DateTimeImmutable;
}

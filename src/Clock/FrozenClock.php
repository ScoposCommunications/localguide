<?php

declare(strict_types=1);

namespace GuideMap\Clock;

use DateTimeImmutable;
use DateTimeZone;

/**
 * A {@see Clock} stopped at a fixed moment, for deterministic tests.
 *
 * The time can be moved on demand with {@see advance()} or {@see set()} — for
 * example, to push past an OAuth token's expiry within a single test.
 */
final class FrozenClock implements Clock
{
    public function __construct(private DateTimeImmutable $now)
    {
    }

    /**
     * Create a clock frozen at an ISO-8601 string (interpreted as UTC).
     */
    public static function at(string $iso8601): self
    {
        return new self(new DateTimeImmutable($iso8601, new DateTimeZone('UTC')));
    }

    public function now(): DateTimeImmutable
    {
        return $this->now;
    }

    public function set(DateTimeImmutable $now): void
    {
        $this->now = $now;
    }

    /**
     * Move the clock forward (or, with a negative value, backward).
     */
    public function advance(int $seconds): void
    {
        $this->now = $this->now->modify(sprintf('%+d seconds', $seconds));
    }
}

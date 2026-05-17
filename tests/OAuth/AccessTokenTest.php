<?php

declare(strict_types=1);

namespace GuideMap\Tests\OAuth;

use DateTimeImmutable;
use DateTimeZone;
use GuideMap\Clock\FrozenClock;
use GuideMap\OAuth\AccessToken;
use GuideMap\Tests\TestCase;

final class AccessTokenTest extends TestCase
{
    private function expiringAt(string $iso8601): AccessToken
    {
        return new AccessToken('token', new DateTimeImmutable($iso8601, new DateTimeZone('UTC')));
    }

    public function test_a_token_with_plenty_of_life_left_is_not_expired(): void
    {
        $clock = FrozenClock::at('2026-05-17T12:00:00');

        self::assertFalse($this->expiringAt('2026-05-17T13:00:00')->isExpired($clock));
    }

    public function test_a_token_within_the_default_buffer_counts_as_expired(): void
    {
        // Expires in 30 seconds; the default buffer is 60.
        $clock = FrozenClock::at('2026-05-17T12:00:00');

        self::assertTrue($this->expiringAt('2026-05-17T12:00:30')->isExpired($clock));
    }

    public function test_a_token_past_its_expiry_is_expired(): void
    {
        $clock = FrozenClock::at('2026-05-17T12:00:00');

        self::assertTrue($this->expiringAt('2026-05-17T11:59:00')->isExpired($clock));
    }

    public function test_the_expiry_buffer_is_configurable(): void
    {
        // Expires in 120 seconds.
        $clock = FrozenClock::at('2026-05-17T12:00:00');
        $token = $this->expiringAt('2026-05-17T12:02:00');

        self::assertFalse($token->isExpired($clock, 60));
        self::assertTrue($token->isExpired($clock, 300));
    }
}

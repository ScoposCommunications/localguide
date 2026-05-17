<?php

declare(strict_types=1);

namespace GuideMap\OAuth;

use DateTimeImmutable;
use GuideMap\Clock\Clock;

/**
 * A short-lived OAuth access token together with the moment it expires.
 */
final readonly class AccessToken
{
    public function __construct(
        public string $token,
        public DateTimeImmutable $expiresAt,
    ) {
    }

    /**
     * Whether the token should be treated as expired.
     *
     * A buffer is applied so the token is refreshed *before* it genuinely
     * expires: the token counts as expired once it is within `$bufferSeconds`
     * of its expiry. This avoids a request being sent with a token that lapses
     * in transit.
     */
    public function isExpired(Clock $clock, int $bufferSeconds = 60): bool
    {
        $secondsLeft = $this->expiresAt->getTimestamp() - $clock->now()->getTimestamp();

        return $secondsLeft <= $bufferSeconds;
    }
}

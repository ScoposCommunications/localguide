<?php

declare(strict_types=1);

namespace GuideMap\OAuth;

/**
 * A {@see TokenProvider} that always hands back the same fixed token string.
 *
 * It performs no OAuth exchange, which makes it the natural double for
 * unit-testing {@see \GuideMap\Drive\DriveClient} in isolation from the OAuth
 * layer, and for the CLI sync simulator. Mirrors the other in-memory test
 * doubles kept in `src/` (DECISIONS.md D16).
 */
final class StaticTokenProvider implements TokenProvider
{
    public function __construct(private readonly string $token = 'test-access-token')
    {
    }

    public function getAccessToken(): string
    {
        return $this->token;
    }
}

<?php

declare(strict_types=1);

namespace GuideMap\OAuth;

/**
 * A {@see TokenCache} that holds the token in memory for the lifetime of the
 * process. Used by tests and the CLI sync simulator.
 */
final class InMemoryTokenCache implements TokenCache
{
    private ?AccessToken $token = null;

    public function get(): ?AccessToken
    {
        return $this->token;
    }

    public function set(AccessToken $token): void
    {
        $this->token = $token;
    }
}

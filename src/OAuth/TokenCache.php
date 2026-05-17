<?php

declare(strict_types=1);

namespace GuideMap\OAuth;

/**
 * Persists the most recently obtained {@see AccessToken} so it can be reused
 * until it nears expiry, instead of refreshing on every call.
 *
 * {@see InMemoryTokenCache} backs dev and tests. The WordPress adapter will
 * add a `$wpdb`/options-backed implementation of this same interface.
 */
interface TokenCache
{
    /**
     * The cached token, or null if nothing has been cached yet.
     */
    public function get(): ?AccessToken;

    /**
     * Store (replacing any previous) the current token.
     */
    public function set(AccessToken $token): void;
}

<?php

declare(strict_types=1);

namespace GuideMap\OAuth;

use GuideMap\OAuth\Exception\InvalidRefreshToken;

/**
 * Supplies a usable OAuth access token on demand.
 *
 * Callers (notably {@see \GuideMap\Drive\DriveClient}) depend on this
 * interface, not on {@see GoogleTokenProvider}, so token acquisition can be
 * faked in tests.
 */
interface TokenProvider
{
    /**
     * Return a valid access token string, refreshing it if necessary.
     *
     * @throws InvalidRefreshToken the refresh token is no longer accepted by
     *                             Google; the user must reconnect their
     *                             account. This is not retryable.
     */
    public function getAccessToken(): string;
}

<?php

declare(strict_types=1);

namespace GuideMap\OAuth;

use GuideMap\Clock\Clock;
use GuideMap\Http\HttpClient;
use GuideMap\OAuth\Exception\InvalidRefreshToken;
use GuideMap\OAuth\Exception\TokenRefreshFailed;

/**
 * A {@see TokenProvider} that mints Google access tokens from a refresh token.
 *
 * On each call it returns the cached token if one is present and not near
 * expiry; otherwise it exchanges the refresh token at Google's OAuth endpoint,
 * caches the result, and returns it.
 *
 * The {@see HttpClient} and {@see Clock} dependencies are what make this
 * testable: {@see \GuideMap\Http\FakeHttpClient} stands in for Google and
 * {@see \GuideMap\Clock\FrozenClock} drives the expiry logic deterministically.
 */
final class GoogleTokenProvider implements TokenProvider
{
    private const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

    /** Assumed token lifetime when Google omits `expires_in` (seconds). */
    private const DEFAULT_LIFETIME = 3600;

    public function __construct(
        private readonly OAuthCredentials $credentials,
        private readonly HttpClient $http,
        private readonly Clock $clock,
        private readonly ?TokenCache $cache = null,
    ) {
    }

    public function getAccessToken(): string
    {
        $cached = $this->cache?->get();
        if ($cached !== null && !$cached->isExpired($this->clock)) {
            return $cached->token;
        }

        $token = $this->refresh();
        $this->cache?->set($token);

        return $token->token;
    }

    /**
     * Exchange the refresh token for a fresh access token at Google's endpoint.
     *
     * @throws InvalidRefreshToken the refresh token was rejected (400/401)
     * @throws TokenRefreshFailed  any other non-2xx, or an unparseable body
     */
    private function refresh(): AccessToken
    {
        $response = $this->http->request(
            'POST',
            self::TOKEN_ENDPOINT,
            ['Content-Type' => 'application/x-www-form-urlencoded'],
            http_build_query([
                'client_id' => $this->credentials->clientId,
                'client_secret' => $this->credentials->clientSecret,
                'refresh_token' => $this->credentials->refreshToken,
                'grant_type' => 'refresh_token',
            ]),
        );

        if ($response->statusCode === 400 || $response->statusCode === 401) {
            throw InvalidRefreshToken::rejectedByGoogle($response->statusCode, $response->body);
        }
        if (!$response->isSuccess()) {
            throw TokenRefreshFailed::unexpectedStatus($response->statusCode, $response->body);
        }

        $decoded = json_decode($response->body, true);
        if (
            !is_array($decoded)
            || !isset($decoded['access_token'])
            || !is_string($decoded['access_token'])
            || $decoded['access_token'] === ''
        ) {
            throw TokenRefreshFailed::malformedResponse($response->body);
        }

        $lifetime = isset($decoded['expires_in']) && is_numeric($decoded['expires_in'])
            ? (int) $decoded['expires_in']
            : self::DEFAULT_LIFETIME;

        return new AccessToken(
            $decoded['access_token'],
            $this->clock->now()->modify(sprintf('+%d seconds', $lifetime)),
        );
    }
}

<?php

declare(strict_types=1);

namespace GuideMap\Tests\OAuth;

use DateTimeImmutable;
use DateTimeZone;
use GuideMap\Clock\FrozenClock;
use GuideMap\Http\FakeHttpClient;
use GuideMap\Http\HttpResponse;
use GuideMap\OAuth\AccessToken;
use GuideMap\OAuth\Exception\InvalidRefreshToken;
use GuideMap\OAuth\Exception\TokenRefreshFailed;
use GuideMap\OAuth\GoogleTokenProvider;
use GuideMap\OAuth\InMemoryTokenCache;
use GuideMap\OAuth\OAuthCredentials;
use GuideMap\Tests\TestCase;

final class GoogleTokenProviderTest extends TestCase
{
    private const TOKEN_ENDPOINT = 'POST https://oauth2.googleapis.com/token';

    private function credentials(): OAuthCredentials
    {
        return new OAuthCredentials('client-id', 'client-secret', 'refresh-token');
    }

    private function tokenResponse(string $accessToken, int $expiresIn = 3600): HttpResponse
    {
        return new HttpResponse(200, [], (string) json_encode([
            'access_token' => $accessToken,
            'expires_in' => $expiresIn,
            'token_type' => 'Bearer',
        ], JSON_THROW_ON_ERROR));
    }

    private function token(string $value, string $expiresAtIso): AccessToken
    {
        return new AccessToken($value, new DateTimeImmutable($expiresAtIso, new DateTimeZone('UTC')));
    }

    public function test_returns_a_valid_cached_token_without_calling_google(): void
    {
        $cache = new InMemoryTokenCache();
        $cache->set($this->token('CACHED', '2026-05-17T13:00:00'));
        $http = new FakeHttpClient();

        $provider = new GoogleTokenProvider(
            $this->credentials(),
            $http,
            FrozenClock::at('2026-05-17T12:00:00'),
            $cache,
        );

        self::assertSame('CACHED', $provider->getAccessToken());
        self::assertSame(0, $http->requestCount());
    }

    public function test_refreshes_when_the_cache_is_empty(): void
    {
        $http = new FakeHttpClient([self::TOKEN_ENDPOINT => $this->tokenResponse('FRESH')]);

        $provider = new GoogleTokenProvider(
            $this->credentials(),
            $http,
            FrozenClock::at('2026-05-17T12:00:00'),
            new InMemoryTokenCache(),
        );

        self::assertSame('FRESH', $provider->getAccessToken());
        self::assertSame(1, $http->requestCount());
    }

    public function test_refreshes_and_stores_when_the_cached_token_is_expired(): void
    {
        $clock = FrozenClock::at('2026-05-17T12:00:00');
        $cache = new InMemoryTokenCache();
        // Already past expiry.
        $cache->set($this->token('STALE', '2026-05-17T11:00:00'));
        $http = new FakeHttpClient([self::TOKEN_ENDPOINT => $this->tokenResponse('REFRESHED')]);

        $provider = new GoogleTokenProvider($this->credentials(), $http, $clock, $cache);

        self::assertSame('REFRESHED', $provider->getAccessToken());
        self::assertSame('REFRESHED', $cache->get()?->token);
        self::assertFalse($cache->get()->isExpired($clock));
    }

    public function test_refreshes_a_token_that_is_inside_the_expiry_buffer(): void
    {
        $clock = FrozenClock::at('2026-05-17T12:00:00');
        $cache = new InMemoryTokenCache();
        // 30 seconds of life left — inside the 60-second refresh buffer.
        $cache->set($this->token('NEARLY', '2026-05-17T12:00:30'));
        $http = new FakeHttpClient([self::TOKEN_ENDPOINT => $this->tokenResponse('REFRESHED')]);

        $provider = new GoogleTokenProvider($this->credentials(), $http, $clock, $cache);

        self::assertSame('REFRESHED', $provider->getAccessToken());
        self::assertSame(1, $http->requestCount());
    }

    public function test_a_refreshed_token_is_cached_so_the_next_call_skips_http(): void
    {
        $http = new FakeHttpClient([self::TOKEN_ENDPOINT => $this->tokenResponse('ONCE')]);
        $provider = new GoogleTokenProvider(
            $this->credentials(),
            $http,
            FrozenClock::at('2026-05-17T12:00:00'),
            new InMemoryTokenCache(),
        );

        $provider->getAccessToken();
        $provider->getAccessToken();

        self::assertSame(1, $http->requestCount());
    }

    public function test_without_a_cache_every_call_refreshes(): void
    {
        $http = new FakeHttpClient([self::TOKEN_ENDPOINT => $this->tokenResponse('A')]);
        $provider = new GoogleTokenProvider(
            $this->credentials(),
            $http,
            FrozenClock::at('2026-05-17T12:00:00'),
            null,
        );

        $provider->getAccessToken();
        $provider->getAccessToken();

        self::assertSame(2, $http->requestCount());
    }

    public function test_sends_a_refresh_token_grant_with_the_credentials(): void
    {
        $http = new FakeHttpClient([self::TOKEN_ENDPOINT => $this->tokenResponse('X')]);
        $provider = new GoogleTokenProvider(
            $this->credentials(),
            $http,
            FrozenClock::at('2026-05-17T12:00:00'),
            null,
        );

        $provider->getAccessToken();

        $request = $http->lastRequest();
        self::assertNotNull($request);
        self::assertSame('POST', $request['method']);
        $body = (string) $request['body'];
        self::assertStringContainsString('grant_type=refresh_token', $body);
        self::assertStringContainsString('refresh_token=refresh-token', $body);
        self::assertStringContainsString('client_id=client-id', $body);
    }

    public function test_a_401_throws_invalid_refresh_token(): void
    {
        $http = new FakeHttpClient([
            self::TOKEN_ENDPOINT => new HttpResponse(401, [], '{"error":"invalid_grant"}'),
        ]);
        $provider = new GoogleTokenProvider(
            $this->credentials(),
            $http,
            FrozenClock::at('2026-05-17T12:00:00'),
            new InMemoryTokenCache(),
        );

        $this->expectException(InvalidRefreshToken::class);
        $provider->getAccessToken();
    }

    public function test_a_400_throws_invalid_refresh_token(): void
    {
        $http = new FakeHttpClient([
            self::TOKEN_ENDPOINT => new HttpResponse(400, [], '{"error":"invalid_grant"}'),
        ]);
        $provider = new GoogleTokenProvider(
            $this->credentials(),
            $http,
            FrozenClock::at('2026-05-17T12:00:00'),
            null,
        );

        $this->expectException(InvalidRefreshToken::class);
        $provider->getAccessToken();
    }

    public function test_a_server_error_throws_token_refresh_failed(): void
    {
        $http = new FakeHttpClient([
            self::TOKEN_ENDPOINT => new HttpResponse(503, [], 'service unavailable'),
        ]);
        $provider = new GoogleTokenProvider(
            $this->credentials(),
            $http,
            FrozenClock::at('2026-05-17T12:00:00'),
            null,
        );

        $this->expectException(TokenRefreshFailed::class);
        $provider->getAccessToken();
    }

    public function test_a_malformed_body_throws_token_refresh_failed(): void
    {
        $http = new FakeHttpClient([
            self::TOKEN_ENDPOINT => new HttpResponse(200, [], 'this is not json'),
        ]);
        $provider = new GoogleTokenProvider(
            $this->credentials(),
            $http,
            FrozenClock::at('2026-05-17T12:00:00'),
            null,
        );

        $this->expectException(TokenRefreshFailed::class);
        $provider->getAccessToken();
    }
}

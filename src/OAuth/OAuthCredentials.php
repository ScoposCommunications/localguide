<?php

declare(strict_types=1);

namespace GuideMap\OAuth;

/**
 * The long-lived Google OAuth 2.0 credentials needed to mint access tokens.
 *
 * The `refreshToken` is obtained once, when the user connects their Google
 * account; the client id/secret identify the application. Together they let
 * {@see GoogleTokenProvider} exchange for short-lived access tokens without
 * any further user interaction.
 */
final readonly class OAuthCredentials
{
    public function __construct(
        public string $clientId,
        public string $clientSecret,
        public string $refreshToken,
    ) {
    }
}

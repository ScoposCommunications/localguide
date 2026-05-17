<?php

declare(strict_types=1);

namespace GuideMap\OAuth\Exception;

use RuntimeException;

/**
 * Google rejected the refresh token (HTTP 400/401).
 *
 * This is an *unrecoverable* auth failure: the token has been revoked or has
 * expired, and no amount of retrying will fix it. The only remedy is for the
 * user to reconnect their Google account and supply a fresh refresh token.
 */
final class InvalidRefreshToken extends RuntimeException
{
    public static function rejectedByGoogle(int $statusCode, string $detail): self
    {
        return new self(sprintf(
            'Google rejected the refresh token (HTTP %d): %s. '
                . 'The user must reconnect their Google account.',
            $statusCode,
            trim($detail) === '' ? '(no detail)' : trim($detail),
        ));
    }
}

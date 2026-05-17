<?php

declare(strict_types=1);

namespace GuideMap\OAuth\Exception;

use RuntimeException;

/**
 * A token refresh failed for a reason that is *not* a rejected refresh token —
 * a 5xx from Google's token endpoint, or a 2xx whose body was not the expected
 * JSON.
 *
 * Unlike {@see InvalidRefreshToken}, this is potentially transient: retrying
 * later may succeed, and the user does not need to reconnect their account.
 */
final class TokenRefreshFailed extends RuntimeException
{
    public static function unexpectedStatus(int $statusCode, string $detail): self
    {
        return new self(sprintf(
            'Google token endpoint returned an unexpected HTTP %d: %s',
            $statusCode,
            trim($detail) === '' ? '(no body)' : trim($detail),
        ));
    }

    public static function malformedResponse(string $body): self
    {
        return new self(sprintf(
            'Google token endpoint returned a body without a usable access_token: %s',
            trim($body) === '' ? '(empty body)' : trim($body),
        ));
    }
}

<?php

declare(strict_types=1);

namespace GuideMap\Http\Exception;

use RuntimeException;

/**
 * An HTTP request could not be completed at the transport level — a DNS
 * failure, a refused connection, a timeout, or (for downloads) a destination
 * file that could not be opened.
 *
 * This is distinct from a completed request that returned a non-2xx status:
 * that is a normal {@see \GuideMap\Http\HttpResponse}, which callers inspect
 * with {@see \GuideMap\Http\HttpResponse::isSuccess()}.
 */
final class HttpRequestFailed extends RuntimeException
{
    public static function forUrl(string $url, string $reason): self
    {
        return new self(sprintf('HTTP request to "%s" failed: %s', $url, $reason));
    }
}

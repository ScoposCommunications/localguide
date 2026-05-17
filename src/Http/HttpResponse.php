<?php

declare(strict_types=1);

namespace GuideMap\Http;

/**
 * An immutable HTTP response.
 *
 * For a streamed download (see {@see HttpClient::download()}) the body is
 * written to disk and {@see $body} is the empty string — only {@see $statusCode}
 * and {@see $headers} are meaningful.
 */
final readonly class HttpResponse
{
    /**
     * @param array<string, string> $headers
     */
    public function __construct(
        public int $statusCode,
        public array $headers,
        public string $body,
    ) {
    }

    /**
     * True for a 2xx status code.
     */
    public function isSuccess(): bool
    {
        return $this->statusCode >= 200 && $this->statusCode < 300;
    }
}

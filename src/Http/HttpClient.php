<?php

declare(strict_types=1);

namespace GuideMap\Http;

use GuideMap\Http\Exception\HttpRequestFailed;

/**
 * A minimal HTTP client, abstracted so the OAuth and Drive clients can be
 * exercised against {@see FakeHttpClient} with no real network.
 *
 * `request()` returns the body in memory; `download()` streams it to disk so a
 * large Takeout export never has to be buffered in a PHP string (DECISIONS.md
 * D15/D18).
 */
interface HttpClient
{
    /**
     * Perform an HTTP request and return the response, body included.
     *
     * @param array<string, string> $headers request headers, name => value
     *
     * @throws HttpRequestFailed the request could not be completed at all
     *                           (DNS, connection, timeout). A non-2xx HTTP
     *                           status is a normal return, not an exception.
     */
    public function request(
        string $method,
        string $url,
        array $headers = [],
        ?string $body = null,
    ): HttpResponse;

    /**
     * Perform an HTTP request and stream the response body straight to a file.
     *
     * The returned {@see HttpResponse} carries the status and headers; its
     * body is empty because the bytes went to `$destinationPath`.
     *
     * @param array<string, string> $headers request headers, name => value
     *
     * @throws HttpRequestFailed the request could not be completed, or the
     *                           destination file could not be opened
     */
    public function download(
        string $method,
        string $url,
        string $destinationPath,
        array $headers = [],
    ): HttpResponse;
}

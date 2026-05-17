<?php

declare(strict_types=1);

namespace GuideMap\Http;

use GuideMap\Http\Exception\HttpRequestFailed;

/**
 * An in-memory {@see HttpClient} for tests and the CLI sync simulator.
 *
 * Canned responses are registered under a `"{METHOD} {URL}"` key. A request is
 * answered by the **longest registered key that is a prefix of** its own
 * `"{METHOD} {URL}"` — so a test can stub `"GET .../drive/v3/files"` and have
 * it answer the real, fully query-stringed request. A key may hold several
 * responses; they are handed out in order (the last one repeats), which makes
 * paginated endpoints testable. See DECISIONS.md D16/D17.
 *
 * Every request is recorded for later assertion via {@see requests()}.
 */
final class FakeHttpClient implements HttpClient
{
    /** @var array<string, list<HttpResponse>> registered responses, longest key wins */
    private array $responses = [];

    /** @var array<string, int> per-key cursor into the response queue */
    private array $cursors = [];

    /** @var list<array{method: string, url: string, headers: array<string, string>, body: ?string}> */
    private array $requests = [];

    /**
     * @param array<string, HttpResponse|list<HttpResponse>> $responses
     *        canned responses keyed by "{METHOD} {URL}"
     */
    public function __construct(array $responses = [])
    {
        foreach ($responses as $key => $value) {
            $this->register($key, $value);
        }
    }

    /**
     * Register one or more canned responses for a method + URL (prefix).
     *
     * @param HttpResponse|list<HttpResponse> $responses
     */
    public function stub(string $method, string $url, HttpResponse|array $responses): void
    {
        $this->register(strtoupper($method) . ' ' . $url, $responses);
    }

    public function request(
        string $method,
        string $url,
        array $headers = [],
        ?string $body = null,
    ): HttpResponse {
        $this->requests[] = [
            'method' => strtoupper($method),
            'url' => $url,
            'headers' => $headers,
            'body' => $body,
        ];

        return $this->responseFor($method, $url);
    }

    public function download(
        string $method,
        string $url,
        string $destinationPath,
        array $headers = [],
    ): HttpResponse {
        $this->requests[] = [
            'method' => strtoupper($method),
            'url' => $url,
            'headers' => $headers,
            'body' => null,
        ];

        $response = $this->responseFor($method, $url);
        file_put_contents($destinationPath, $response->body);

        return new HttpResponse($response->statusCode, $response->headers, '');
    }

    /**
     * Every request received, oldest first.
     *
     * @return list<array{method: string, url: string, headers: array<string, string>, body: ?string}>
     */
    public function requests(): array
    {
        return $this->requests;
    }

    /**
     * @return array{method: string, url: string, headers: array<string, string>, body: ?string}|null
     */
    public function lastRequest(): ?array
    {
        return $this->requests === [] ? null : $this->requests[array_key_last($this->requests)];
    }

    public function requestCount(): int
    {
        return count($this->requests);
    }

    /**
     * @param HttpResponse|list<HttpResponse> $value
     */
    private function register(string $key, HttpResponse|array $value): void
    {
        $parts = explode(' ', $key, 2);
        $normalized = count($parts) === 2
            ? strtoupper($parts[0]) . ' ' . $parts[1]
            : $key;

        $this->responses[$normalized] = $value instanceof HttpResponse
            ? [$value]
            : array_values($value);
        $this->cursors[$normalized] = 0;
    }

    private function responseFor(string $method, string $url): HttpResponse
    {
        $target = strtoupper($method) . ' ' . $url;

        $matchedKey = null;
        foreach (array_keys($this->responses) as $key) {
            if (str_starts_with($target, $key)
                && ($matchedKey === null || strlen($key) > strlen($matchedKey))
            ) {
                $matchedKey = $key;
            }
        }

        if ($matchedKey === null) {
            throw HttpRequestFailed::forUrl(
                $url,
                sprintf('FakeHttpClient has no canned response for "%s"', $target),
            );
        }

        $queue = $this->responses[$matchedKey];
        $cursor = $this->cursors[$matchedKey];
        $this->cursors[$matchedKey] = min($cursor + 1, count($queue) - 1);

        return $queue[$cursor] ?? $queue[count($queue) - 1];
    }
}

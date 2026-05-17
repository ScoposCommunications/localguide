<?php

declare(strict_types=1);

namespace GuideMap\Tests\Http;

use GuideMap\Http\Exception\HttpRequestFailed;
use GuideMap\Http\FakeHttpClient;
use GuideMap\Http\HttpResponse;
use GuideMap\Tests\TestCase;

final class FakeHttpClientTest extends TestCase
{
    public function test_returns_a_canned_response_for_an_exact_match(): void
    {
        $client = new FakeHttpClient([
            'GET https://example.test/ping' => new HttpResponse(200, [], 'pong'),
        ]);

        $response = $client->request('GET', 'https://example.test/ping');

        self::assertSame(200, $response->statusCode);
        self::assertSame('pong', $response->body);
    }

    public function test_matches_a_registered_key_as_a_url_prefix(): void
    {
        $client = new FakeHttpClient([
            'GET https://example.test/files' => new HttpResponse(200, [], 'listing'),
        ]);

        $response = $client->request('GET', 'https://example.test/files?q=abc&pageSize=100');

        self::assertSame('listing', $response->body);
    }

    public function test_longest_matching_prefix_wins(): void
    {
        $client = new FakeHttpClient([
            'GET https://example.test/files' => new HttpResponse(200, [], 'generic'),
            'GET https://example.test/files/123' => new HttpResponse(200, [], 'specific'),
        ]);

        self::assertSame(
            'specific',
            $client->request('GET', 'https://example.test/files/123?alt=media')->body,
        );
        self::assertSame(
            'generic',
            $client->request('GET', 'https://example.test/files?q=x')->body,
        );
    }

    public function test_a_response_queue_is_returned_in_order_then_sticks(): void
    {
        $client = new FakeHttpClient([
            'GET https://example.test/page' => [
                new HttpResponse(200, [], 'one'),
                new HttpResponse(200, [], 'two'),
            ],
        ]);

        self::assertSame('one', $client->request('GET', 'https://example.test/page')->body);
        self::assertSame('two', $client->request('GET', 'https://example.test/page')->body);
        self::assertSame('two', $client->request('GET', 'https://example.test/page')->body);
    }

    public function test_method_is_part_of_the_match(): void
    {
        $client = new FakeHttpClient();
        $client->stub('POST', 'https://example.test/x', new HttpResponse(201, [], 'created'));

        self::assertSame('created', $client->request('POST', 'https://example.test/x')->body);

        $this->expectException(HttpRequestFailed::class);
        $client->request('GET', 'https://example.test/x');
    }

    public function test_records_every_request_for_assertion(): void
    {
        $client = new FakeHttpClient([
            'POST https://example.test/x' => new HttpResponse(200, [], ''),
        ]);

        $client->request('POST', 'https://example.test/x', ['Authorization' => 'Bearer t'], 'payload');

        self::assertSame(1, $client->requestCount());
        $last = $client->lastRequest();
        self::assertNotNull($last);
        self::assertSame('POST', $last['method']);
        self::assertSame('https://example.test/x', $last['url']);
        self::assertSame('Bearer t', $last['headers']['Authorization']);
        self::assertSame('payload', $last['body']);
    }

    public function test_throws_when_no_canned_response_matches(): void
    {
        $this->expectException(HttpRequestFailed::class);

        (new FakeHttpClient())->request('GET', 'https://example.test/missing');
    }

    public function test_download_writes_the_body_to_the_destination(): void
    {
        $client = new FakeHttpClient([
            'GET https://example.test/file' => new HttpResponse(200, [], 'ZIPBYTES'),
        ]);
        $path = sys_get_temp_dir() . '/guidemap-fakehttp-' . uniqid('', true) . '.bin';

        try {
            $response = $client->download('GET', 'https://example.test/file', $path);

            self::assertSame(200, $response->statusCode);
            self::assertSame('', $response->body);
            self::assertSame('ZIPBYTES', file_get_contents($path));
            self::assertSame(1, $client->requestCount());
        } finally {
            if (is_file($path)) {
                unlink($path);
            }
        }
    }
}

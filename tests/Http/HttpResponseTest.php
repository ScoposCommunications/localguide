<?php

declare(strict_types=1);

namespace GuideMap\Tests\Http;

use GuideMap\Http\HttpResponse;
use GuideMap\Tests\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

final class HttpResponseTest extends TestCase
{
    #[DataProvider('successfulStatuses')]
    public function test_2xx_statuses_are_successful(int $status): void
    {
        self::assertTrue((new HttpResponse($status, [], ''))->isSuccess());
    }

    /** @return array<string, array{0: int}> */
    public static function successfulStatuses(): array
    {
        return ['200' => [200], '201' => [201], '204' => [204], '299' => [299]];
    }

    #[DataProvider('unsuccessfulStatuses')]
    public function test_non_2xx_statuses_are_not_successful(int $status): void
    {
        self::assertFalse((new HttpResponse($status, [], ''))->isSuccess());
    }

    /** @return array<string, array{0: int}> */
    public static function unsuccessfulStatuses(): array
    {
        return ['199' => [199], '301' => [301], '400' => [400], '404' => [404], '500' => [500]];
    }

    public function test_exposes_status_headers_and_body(): void
    {
        $response = new HttpResponse(200, ['Content-Type' => 'application/json'], '{"ok":true}');

        self::assertSame(200, $response->statusCode);
        self::assertSame('application/json', $response->headers['Content-Type']);
        self::assertSame('{"ok":true}', $response->body);
    }
}

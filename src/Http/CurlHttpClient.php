<?php

declare(strict_types=1);

namespace GuideMap\Http;

use CurlHandle;
use GuideMap\Http\Exception\HttpRequestFailed;

/**
 * The production {@see HttpClient}, built on PHP's cURL extension.
 *
 * Not exercised by the unit suite (that uses {@see FakeHttpClient}); it is the
 * real implementation the WordPress adapter will wire in.
 */
final class CurlHttpClient implements HttpClient
{
    public function __construct(private readonly int $timeoutSeconds = 30)
    {
    }

    public function request(
        string $method,
        string $url,
        array $headers = [],
        ?string $body = null,
    ): HttpResponse {
        $responseHeaders = [];
        $handle = $this->newHandle($method, $url, $headers, $responseHeaders);
        curl_setopt($handle, CURLOPT_RETURNTRANSFER, true);
        if ($body !== null) {
            curl_setopt($handle, CURLOPT_POSTFIELDS, $body);
        }

        $result = curl_exec($handle);
        if ($result === false) {
            $error = curl_error($handle);
            curl_close($handle);
            throw HttpRequestFailed::forUrl($url, $error);
        }

        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        curl_close($handle);

        return new HttpResponse($status, $responseHeaders, (string) $result);
    }

    public function download(
        string $method,
        string $url,
        string $destinationPath,
        array $headers = [],
    ): HttpResponse {
        $file = fopen($destinationPath, 'wb');
        if ($file === false) {
            throw HttpRequestFailed::forUrl(
                $url,
                'could not open destination file for writing: ' . $destinationPath,
            );
        }

        $responseHeaders = [];
        $handle = $this->newHandle($method, $url, $headers, $responseHeaders);
        // Hand cURL the open file so the body streams disk-to-disk (D18).
        curl_setopt($handle, CURLOPT_FILE, $file);

        $result = curl_exec($handle);
        $error = curl_error($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        curl_close($handle);
        fclose($file);

        if ($result === false) {
            @unlink($destinationPath);
            throw HttpRequestFailed::forUrl($url, $error);
        }

        return new HttpResponse($status, $responseHeaders, '');
    }

    /**
     * Create a cURL handle with the options common to both request modes.
     * Response headers are accumulated into `$responseHeaders` by reference.
     *
     * @param array<string, string> $headers
     * @param array<string, string> $responseHeaders
     */
    private function newHandle(
        string $method,
        string $url,
        array $headers,
        array &$responseHeaders,
    ): CurlHandle {
        $handle = curl_init();

        curl_setopt_array($handle, [
            CURLOPT_URL => $url,
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_TIMEOUT => $this->timeoutSeconds,
            CURLOPT_CONNECTTIMEOUT => $this->timeoutSeconds,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_HTTPHEADER => $this->formatHeaders($headers),
            CURLOPT_HEADERFUNCTION => static function (
                CurlHandle $_handle,
                string $line,
            ) use (&$responseHeaders): int {
                $parts = explode(':', $line, 2);
                if (count($parts) === 2) {
                    $responseHeaders[trim($parts[0])] = trim($parts[1]);
                }

                return strlen($line);
            },
        ]);

        return $handle;
    }

    /**
     * Convert a name => value map into cURL's "Name: value" header list.
     *
     * @param array<string, string> $headers
     *
     * @return list<string>
     */
    private function formatHeaders(array $headers): array
    {
        $formatted = [];
        foreach ($headers as $name => $value) {
            $formatted[] = $name . ': ' . $value;
        }

        return $formatted;
    }
}

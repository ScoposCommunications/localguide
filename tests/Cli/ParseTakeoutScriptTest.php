<?php

declare(strict_types=1);

namespace GuideMap\Tests\Cli;

use GuideMap\Tests\TestCase;

/**
 * Exercises scripts/parse-takeout.php as a real subprocess, the way the
 * developer runs it, so the CLI entry point itself is regression-covered.
 */
final class ParseTakeoutScriptTest extends TestCase
{
    private function script(): string
    {
        return $this->projectRoot() . '/scripts/parse-takeout.php';
    }

    /**
     * @return array{output: string, exitCode: int}
     */
    private function runScript(string ...$args): array
    {
        $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg($this->script());
        foreach ($args as $arg) {
            $command .= ' ' . escapeshellarg($arg);
        }
        $command .= ' 2>&1';

        $output = [];
        $exitCode = 0;
        exec($command, $output, $exitCode);

        return ['output' => implode("\n", $output), 'exitCode' => $exitCode];
    }

    public function test_parses_the_sample_zip_and_prints_a_summary(): void
    {
        $run = $this->runScript($this->fixturePath('takeout-sample.zip'));

        self::assertSame(0, $run['exitCode'], $run['output']);
        self::assertStringContainsString('Parsed 16 contributions from 4 files', $run['output']);
        self::assertStringContainsString('5 reviews', $run['output']);
        self::assertStringContainsString('4 photos', $run['output']);
        self::assertStringContainsString('4 starred places', $run['output']);
        self::assertStringContainsString('3 questions', $run['output']);
        self::assertStringContainsString('Inserted 16 rows (0 duplicates)', $run['output']);
        self::assertStringContainsString('avg rating 4.6', $run['output']);
        self::assertStringContainsString('Database written to', $run['output']);
    }

    public function test_prints_usage_and_fails_when_no_path_is_given(): void
    {
        $run = $this->runScript();

        self::assertSame(1, $run['exitCode']);
        self::assertStringContainsString('Usage', $run['output']);
    }

    public function test_fails_gracefully_for_a_missing_input(): void
    {
        $run = $this->runScript('/tmp/guidemap-cli-missing-' . uniqid() . '.zip');

        self::assertSame(2, $run['exitCode']);
        self::assertStringContainsString('Could not parse', $run['output']);
    }
}

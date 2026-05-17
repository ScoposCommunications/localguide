<?php

declare(strict_types=1);

namespace GuideMap\Tests\Cli;

use GuideMap\Tests\TestCase;

/**
 * Exercises scripts/sync-simulator.php as a real subprocess, so the end-to-end
 * sync flow (Drive listing, download, parse, store, dedup) is regression
 * covered with no network.
 */
final class SyncSimulatorScriptTest extends TestCase
{
    public function test_runs_the_orchestrator_end_to_end(): void
    {
        $command = escapeshellarg(PHP_BINARY)
            . ' ' . escapeshellarg($this->projectRoot() . '/scripts/sync-simulator.php')
            . ' 2>&1';

        $output = [];
        $exitCode = 0;
        exec($command, $output, $exitCode);
        $text = implode("\n", $output);

        self::assertSame(0, $exitCode, $text);
        self::assertStringContainsString('Run 1 - fresh sync', $text);
        self::assertStringContainsString('Scanned 3 files, processed 3 new', $text);
        self::assertStringContainsString('16 inserted', $text);
        self::assertStringContainsString('Run 2', $text);
        self::assertStringContainsString('processed 0 new', $text);
        self::assertStringContainsString('16 rows', $text);
    }
}

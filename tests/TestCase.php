<?php

declare(strict_types=1);

namespace GuideMap\Tests;

use PHPUnit\Framework\TestCase as PHPUnitTestCase;

/**
 * Shared base for the GuideMap Pro test suite: locates the project root and
 * loads JSON fixtures.
 */
abstract class TestCase extends PHPUnitTestCase
{
    protected function projectRoot(): string
    {
        return dirname(__DIR__);
    }

    protected function fixturesDir(): string
    {
        return $this->projectRoot() . '/fixtures';
    }

    protected function fixturePath(string $name): string
    {
        return $this->fixturesDir() . '/' . $name;
    }

    /**
     * Load and JSON-decode a fixture file from /fixtures.
     *
     * @return array<string, mixed>
     */
    protected function fixture(string $name): array
    {
        $raw = file_get_contents($this->fixturePath($name));
        self::assertIsString($raw, "Fixture is not readable: {$name}");

        /** @var array<string, mixed> $decoded */
        $decoded = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);

        return $decoded;
    }
}

<?php

declare(strict_types=1);

namespace GuideMap\Tests\Storage;

use GuideMap\Storage\Schema;
use GuideMap\Tests\TestCase;
use PDO;

final class SchemaTest extends TestCase
{
    private const COLUMNS = [
        'id', 'place_name', 'place_address', 'lat', 'lng', 'google_maps_url',
        'type', 'rating', 'review_text', 'date', 'photo_views', 'hash', 'created_at',
    ];

    public function test_table_name_is_contributions(): void
    {
        self::assertSame('contributions', Schema::TABLE);
    }

    public function test_sqlite_ddl_declares_every_column(): void
    {
        $ddl = Schema::sqlite();

        foreach (self::COLUMNS as $column) {
            self::assertStringContainsString($column, $ddl);
        }
        self::assertStringContainsString('AUTOINCREMENT', $ddl);
    }

    public function test_mysql_ddl_uses_mysql_specific_syntax(): void
    {
        $ddl = Schema::mysql();

        foreach (self::COLUMNS as $column) {
            self::assertStringContainsString($column, $ddl);
        }
        self::assertStringContainsString('AUTO_INCREMENT', $ddl);
        self::assertStringContainsString('BIGINT UNSIGNED', $ddl);
        self::assertStringContainsString('DECIMAL(10,7)', $ddl);
        self::assertStringContainsString('PRIMARY KEY', $ddl);
    }

    public function test_statements_splits_the_ddl_into_executable_parts(): void
    {
        // One CREATE TABLE plus three CREATE INDEX statements.
        $statements = Schema::statements(Schema::sqlite());

        self::assertCount(4, $statements);
        foreach ($statements as $statement) {
            self::assertNotSame('', $statement);
        }
    }

    public function test_sqlite_schema_applies_cleanly_to_a_database(): void
    {
        $pdo = new PDO('sqlite::memory:');
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        foreach (Schema::statements(Schema::sqlite()) as $statement) {
            $pdo->exec($statement);
        }

        /** @var list<string> $columns */
        $columns = $pdo->query('PRAGMA table_info(contributions)')
            ->fetchAll(PDO::FETCH_COLUMN, 1);
        sort($columns);

        $expected = self::COLUMNS;
        sort($expected);

        self::assertSame($expected, $columns);
    }
}

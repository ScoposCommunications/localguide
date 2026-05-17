<?php

declare(strict_types=1);

namespace GuideMap\Storage;

use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Exception;
use GuideMap\Contribution;
use GuideMap\ContributionType;
use PDO;
use Throwable;

/**
 * SQLite-backed {@see ContributionRepository}, used for local development and
 * the test suite.
 *
 * It deliberately uses only generic SQL so the queries behave the same way
 * against the MySQL schema; the future `WpdbContributionRepository` will
 * implement the same interface against `$wpdb`. The dedup hash column is
 * UNIQUE, and {@see insertMany()} uses `INSERT OR IGNORE`, so importing the
 * same export repeatedly is a no-op.
 */
final class SqliteContributionRepository implements ContributionRepository
{
    /** Storage format for the `date` and `created_at` columns (UTC). */
    private const DATE_FORMAT = 'Y-m-d H:i:s';

    public function __construct(private readonly PDO $pdo)
    {
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $this->migrate();
    }

    /**
     * Open an on-disk SQLite database (created if missing) and ensure the
     * schema exists.
     */
    public static function fromFile(string $path): self
    {
        return new self(new PDO('sqlite:' . $path));
    }

    /**
     * Open a transient in-memory database — used by the test suite.
     */
    public static function inMemory(): self
    {
        return new self(new PDO('sqlite::memory:'));
    }

    public function insertMany(array $contributions): InsertResult
    {
        $sql = 'INSERT OR IGNORE INTO ' . Schema::TABLE . ' '
            . '(place_name, place_address, lat, lng, google_maps_url, type, '
            . 'rating, review_text, date, photo_views, hash) VALUES '
            . '(:place_name, :place_address, :lat, :lng, :google_maps_url, :type, '
            . ':rating, :review_text, :date, :photo_views, :hash)';
        $statement = $this->pdo->prepare($sql);

        $inserted = 0;
        $duplicates = 0;
        $attempted = 0;

        $this->pdo->beginTransaction();
        try {
            foreach ($contributions as $contribution) {
                $attempted++;
                $statement->execute([
                    'place_name' => $contribution->placeName,
                    'place_address' => $contribution->placeAddress,
                    'lat' => $contribution->lat,
                    'lng' => $contribution->lng,
                    'google_maps_url' => $contribution->googleMapsUrl,
                    'type' => $contribution->type->value,
                    'rating' => $contribution->rating,
                    'review_text' => $contribution->reviewText,
                    'date' => $contribution->date->format(self::DATE_FORMAT),
                    'photo_views' => $contribution->photoViews,
                    'hash' => $contribution->hash,
                ]);
                // INSERT OR IGNORE reports 0 affected rows when the UNIQUE
                // hash already exists — that is how duplicates are counted.
                if ($statement->rowCount() > 0) {
                    $inserted++;
                } else {
                    $duplicates++;
                }
            }
            $this->pdo->commit();
        } catch (Throwable $exception) {
            $this->pdo->rollBack();
            throw $exception;
        }

        return new InsertResult($inserted, $duplicates, $attempted);
    }

    public function all(array $filters = []): array
    {
        [$where, $params] = $this->buildWhere($filters);

        $sql = 'SELECT * FROM ' . Schema::TABLE;
        if ($where !== []) {
            $sql .= ' WHERE ' . implode(' AND ', $where);
        }
        $sql .= ' ORDER BY date DESC, id DESC';

        if (isset($filters['limit'])) {
            $sql .= ' LIMIT ' . max(0, (int) $filters['limit']);
            if (isset($filters['offset'])) {
                $sql .= ' OFFSET ' . max(0, (int) $filters['offset']);
            }
        }

        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);

        $contributions = [];
        foreach ($statement->fetchAll() as $row) {
            $contributions[] = $this->hydrate($row);
        }

        return $contributions;
    }

    public function find(int $id): ?Contribution
    {
        $statement = $this->pdo->prepare(
            'SELECT * FROM ' . Schema::TABLE . ' WHERE id = :id',
        );
        $statement->execute(['id' => $id]);
        $row = $statement->fetch();

        return $row === false ? null : $this->hydrate($row);
    }

    public function stats(): Stats
    {
        $row = $this->pdo->query(
            'SELECT COUNT(*) AS total, AVG(rating) AS avg_rating, '
            . 'MIN(date) AS min_date, MAX(date) AS max_date FROM ' . Schema::TABLE,
        )->fetch();

        $total = (int) $row['total'];

        return new Stats(
            total: $total,
            byType: $this->types(),
            averageRating: $row['avg_rating'] !== null
                ? round((float) $row['avg_rating'], 2)
                : null,
            earliestDate: $total > 0 && $row['min_date'] !== null
                ? $this->parseStoredDate((string) $row['min_date'])
                : null,
            latestDate: $total > 0 && $row['max_date'] !== null
                ? $this->parseStoredDate((string) $row['max_date'])
                : null,
        );
    }

    public function types(): array
    {
        $statement = $this->pdo->query(
            'SELECT type, COUNT(*) AS n FROM ' . Schema::TABLE
            . ' GROUP BY type ORDER BY type',
        );

        $counts = [];
        foreach ($statement as $row) {
            $counts[(string) $row['type']] = (int) $row['n'];
        }

        return $counts;
    }

    public function count(): int
    {
        return (int) $this->pdo
            ->query('SELECT COUNT(*) FROM ' . Schema::TABLE)
            ->fetchColumn();
    }

    public function truncate(): void
    {
        $this->pdo->exec('DELETE FROM ' . Schema::TABLE);

        // Reset the AUTOINCREMENT counter. The sqlite_sequence table only
        // exists once an AUTOINCREMENT row has been inserted.
        $hasSequence = $this->pdo
            ->query("SELECT name FROM sqlite_master "
                . "WHERE type = 'table' AND name = 'sqlite_sequence'")
            ->fetchColumn();
        if ($hasSequence !== false) {
            $this->pdo->exec(
                "DELETE FROM sqlite_sequence WHERE name = '" . Schema::TABLE . "'",
            );
        }
    }

    /**
     * Create the table and indexes if they do not yet exist.
     */
    private function migrate(): void
    {
        foreach (Schema::statements(Schema::sqlite()) as $statement) {
            $this->pdo->exec($statement);
        }
    }

    /**
     * Translate a filter array into a list of SQL conditions and bound
     * parameters.
     *
     * @param array<string, mixed> $filters
     *
     * @return array{0: list<string>, 1: array<string, mixed>}
     */
    private function buildWhere(array $filters): array
    {
        $where = [];
        $params = [];

        $type = $filters['type'] ?? null;
        if ($type instanceof ContributionType) {
            $type = $type->value;
        }
        if (is_string($type) && $type !== '') {
            $where[] = 'type = :type';
            $params['type'] = $type;
        }

        if (isset($filters['date_from']) && $filters['date_from'] !== '') {
            $where[] = 'date >= :date_from';
            $params['date_from'] = $this->normalizeBound($filters['date_from']);
        }
        if (isset($filters['date_to']) && $filters['date_to'] !== '') {
            $where[] = 'date <= :date_to';
            $params['date_to'] = $this->normalizeBound($filters['date_to'], endOfDay: true);
        }

        if (isset($filters['search']) && $filters['search'] !== '') {
            // ESCAPE '\' so literal % and _ in the search term are not
            // treated as LIKE wildcards.
            $where[] = "(place_name LIKE :search ESCAPE '\\' "
                . "OR place_address LIKE :search ESCAPE '\\' "
                . "OR review_text LIKE :search ESCAPE '\\')";
            $params['search'] = '%' . $this->escapeLike((string) $filters['search']) . '%';
        }

        return [$where, $params];
    }

    /**
     * Normalize a date filter bound to the stored 'Y-m-d H:i:s' format.
     *
     * A bare date with no time component is widened: a lower bound starts at
     * 00:00:00, an upper bound ends at 23:59:59, so a `date_to` of
     * "2024-03-01" includes everything that happened that day.
     */
    private function normalizeBound(mixed $value, bool $endOfDay = false): string
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format(self::DATE_FORMAT);
        }

        $value = trim((string) $value);
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1) {
            return $value . ($endOfDay ? ' 23:59:59' : ' 00:00:00');
        }

        try {
            $date = new DateTimeImmutable($value, new DateTimeZone('UTC'));

            return $date->format(self::DATE_FORMAT);
        } catch (Exception) {
            return $value;
        }
    }

    /**
     * Escape characters that LIKE treats specially, for use with `ESCAPE '\'`.
     */
    private function escapeLike(string $value): string
    {
        return str_replace(
            ['\\', '%', '_'],
            ['\\\\', '\\%', '\\_'],
            $value,
        );
    }

    /**
     * Rebuild a {@see Contribution} from a database row. The stored hash is
     * trusted and reused rather than recomputed.
     *
     * @param array<string, mixed> $row
     */
    private function hydrate(array $row): Contribution
    {
        return new Contribution(
            placeName: (string) $row['place_name'],
            placeAddress: (string) $row['place_address'],
            lat: (float) $row['lat'],
            lng: (float) $row['lng'],
            googleMapsUrl: (string) $row['google_maps_url'],
            type: ContributionType::from((string) $row['type']),
            rating: $row['rating'] !== null ? (int) $row['rating'] : null,
            reviewText: $row['review_text'] !== null ? (string) $row['review_text'] : null,
            date: $this->parseStoredDate((string) $row['date']),
            photoViews: (int) $row['photo_views'],
            hash: (string) $row['hash'],
        );
    }

    /**
     * Parse a value stored in the `date` column back into a UTC
     * DateTimeImmutable.
     */
    private function parseStoredDate(string $value): DateTimeImmutable
    {
        $utc = new DateTimeZone('UTC');

        $date = DateTimeImmutable::createFromFormat('!' . self::DATE_FORMAT, $value, $utc);
        if ($date instanceof DateTimeImmutable) {
            return $date;
        }

        try {
            return new DateTimeImmutable($value, $utc);
        } catch (Exception) {
            return new DateTimeImmutable('@0');
        }
    }
}

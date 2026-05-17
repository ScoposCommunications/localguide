<?php

declare(strict_types=1);

namespace GuideMap\Tests\Parser;

use GuideMap\Contribution;
use GuideMap\ContributionType;
use GuideMap\Parser\QuestionsParser;
use GuideMap\Tests\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;

final class QuestionsParserTest extends TestCase
{
    /**
     * @param array<string, mixed> $question
     */
    private function parseOne(array $question): Contribution
    {
        $result = (new QuestionsParser())->parse(['questions' => [$question]]);

        self::assertCount(1, $result);

        return $result[0];
    }

    public function test_question_text_is_stored_in_review_text(): void
    {
        $contribution = $this->parseOne([
            'place_name' => 'Place',
            'place_url' => 'https://maps/x',
            'question_text' => 'Do they take reservations?',
            'date' => '2020-01-01',
            'latitude' => 1.0,
            'longitude' => 2.0,
        ]);

        self::assertSame(ContributionType::Question, $contribution->type);
        self::assertSame('Do they take reservations?', $contribution->reviewText);
        self::assertNull($contribution->rating);
    }

    #[DataProvider('questionTextVariants')]
    public function test_question_text_is_read_from_every_field_name_variant(string $field): void
    {
        $contribution = $this->parseOne([
            'place_name' => 'Place',
            'place_url' => 'https://maps/x',
            'date' => '2020-01-01',
            'latitude' => 1.0,
            'longitude' => 2.0,
            $field => 'How late are you open on weekends?',
        ]);

        self::assertSame('How late are you open on weekends?', $contribution->reviewText);
    }

    /** @return array<string, array{0: string}> */
    public static function questionTextVariants(): array
    {
        return [
            'question_text' => ['question_text'],
            'Question Text' => ['Question Text'],
            'question' => ['question'],
        ];
    }

    #[DataProvider('placeUrlVariants')]
    public function test_place_url_is_read_from_every_field_name_variant(string $field): void
    {
        $contribution = $this->parseOne([
            'place_name' => 'Place',
            'question_text' => 'A question?',
            'date' => '2020-01-01',
            'latitude' => 1.0,
            'longitude' => 2.0,
            $field => 'https://maps/the-place',
        ]);

        self::assertSame('https://maps/the-place', $contribution->googleMapsUrl);
    }

    /** @return array<string, array{0: string}> */
    public static function placeUrlVariants(): array
    {
        return [
            'place_url' => ['place_url'],
            'placeUrl' => ['placeUrl'],
            'google_maps_url' => ['google_maps_url'],
        ];
    }

    public function test_coordinates_are_read_from_nested_or_flat_location(): void
    {
        $nested = $this->parseOne([
            'place_name' => 'P',
            'place_url' => 'u',
            'question_text' => 'q?',
            'location' => ['latitude' => 1.5, 'longitude' => 2.5],
        ]);
        $flat = $this->parseOne([
            'place_name' => 'P',
            'place_url' => 'u',
            'question_text' => 'q?',
            'latitude' => 3.5,
            'longitude' => 4.5,
        ]);

        self::assertSame([1.5, 2.5], [$nested->lat, $nested->lng]);
        self::assertSame([3.5, 4.5], [$flat->lat, $flat->lng]);
    }

    public function test_skips_questions_without_coordinates(): void
    {
        $result = (new QuestionsParser())->parse(['questions' => [
            ['place_name' => 'No Coords', 'place_url' => 'u', 'question_text' => 'q?'],
            [
                'place_name' => 'Has Coords',
                'place_url' => 'u2',
                'question_text' => 'q?',
                'latitude' => 1.0,
                'longitude' => 2.0,
            ],
        ]]);

        self::assertCount(1, $result);
        self::assertSame('Has Coords', $result[0]->placeName);
    }

    public function test_parses_a_single_flat_question_object(): void
    {
        $result = (new QuestionsParser())->parse([
            'place_name' => 'Solo Question Place',
            'place_url' => 'u',
            'question_text' => 'Solo?',
            'latitude' => 1.0,
            'longitude' => 2.0,
        ]);

        self::assertCount(1, $result);
        self::assertSame('Solo Question Place', $result[0]->placeName);
    }

    public function test_parses_the_questions_fixture(): void
    {
        $result = (new QuestionsParser())->parse($this->fixture('questions.json'));

        self::assertCount(3, $result);

        $byName = [];
        foreach ($result as $contribution) {
            self::assertSame(ContributionType::Question, $contribution->type);
            self::assertNull($contribution->rating);
            $byName[$contribution->placeName] = $contribution;
        }

        self::assertArrayHasKey("Powell's City of Books", $byName);
        self::assertStringContainsString('cafe', (string) $byName["Powell's City of Books"]->reviewText);
        // This question names its place only through a nested location object.
        self::assertArrayHasKey('Gardens by the Bay', $byName);
    }
}

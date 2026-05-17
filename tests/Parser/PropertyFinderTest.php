<?php

declare(strict_types=1);

namespace GuideMap\Tests\Parser;

use GuideMap\Parser\PropertyFinder;
use GuideMap\Tests\TestCase;

final class PropertyFinderTest extends TestCase
{
    public function test_finds_an_exact_key_match(): void
    {
        self::assertSame('hello', PropertyFinder::find(['name' => 'hello'], ['name']));
    }

    public function test_key_matching_is_case_insensitive(): void
    {
        $data = ['Star Rating' => 5];

        self::assertSame(5, PropertyFinder::find($data, ['star rating']));
        self::assertSame(5, PropertyFinder::find($data, ['STAR RATING']));
    }

    public function test_traverses_dot_notation_paths(): void
    {
        $data = ['location' => ['name' => 'Cafe', 'geo' => ['lat' => 1.5]]];

        self::assertSame('Cafe', PropertyFinder::find($data, ['location.name']));
        self::assertSame(1.5, PropertyFinder::find($data, ['location.geo.lat']));
    }

    public function test_dot_notation_segments_are_also_case_insensitive(): void
    {
        $data = ['Location' => ['Name' => 'Cafe']];

        self::assertSame('Cafe', PropertyFinder::find($data, ['location.name']));
    }

    public function test_returns_the_first_resolvable_candidate(): void
    {
        $data = ['second' => 'B', 'third' => 'C'];

        self::assertSame('B', PropertyFinder::find($data, ['first', 'second', 'third']));
    }

    public function test_returns_null_when_no_candidate_matches(): void
    {
        self::assertNull(PropertyFinder::find(['name' => 'x'], ['missing', 'absent']));
    }

    public function test_a_null_value_is_treated_as_not_found(): void
    {
        $data = ['primary' => null, 'fallback' => 'used'];

        self::assertSame('used', PropertyFinder::find($data, ['primary', 'fallback']));
    }

    public function test_dot_path_returns_null_when_an_intermediate_segment_is_missing(): void
    {
        self::assertNull(PropertyFinder::find(['location' => ['name' => 'x']], ['location.address.city']));
    }

    public function test_dot_path_returns_null_when_an_intermediate_segment_is_not_an_array(): void
    {
        self::assertNull(PropertyFinder::find(['location' => 'flat string'], ['location.name']));
    }

    public function test_find_string_trims_and_casts(): void
    {
        self::assertSame('Cafe', PropertyFinder::findString(['name' => '  Cafe  '], ['name']));
        self::assertSame('42', PropertyFinder::findString(['n' => 42], ['n']));
    }

    public function test_find_string_returns_null_for_empty_or_array_values(): void
    {
        self::assertNull(PropertyFinder::findString(['name' => '   '], ['name']));
        self::assertNull(PropertyFinder::findString(['name' => []], ['name']));
        self::assertNull(PropertyFinder::findString(['name' => 'x'], ['other']));
    }

    public function test_find_float_accepts_numbers_and_numeric_strings(): void
    {
        self::assertSame(1.5, PropertyFinder::findFloat(['v' => 1.5], ['v']));
        self::assertSame(2.0, PropertyFinder::findFloat(['v' => 2], ['v']));
        self::assertSame(-0.1277583, PropertyFinder::findFloat(['v' => '-0.1277583'], ['v']));
        self::assertNull(PropertyFinder::findFloat(['v' => 'not a number'], ['v']));
    }

    public function test_find_int_accepts_numbers_and_numeric_strings(): void
    {
        self::assertSame(5, PropertyFinder::findInt(['v' => 5], ['v']));
        self::assertSame(4, PropertyFinder::findInt(['v' => '4'], ['v']));
        self::assertSame(3, PropertyFinder::findInt(['v' => 3.9], ['v']));
        self::assertNull(PropertyFinder::findInt(['v' => 'three'], ['v']));
    }
}

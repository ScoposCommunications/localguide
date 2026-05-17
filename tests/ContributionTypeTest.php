<?php

declare(strict_types=1);

namespace GuideMap\Tests;

use GuideMap\ContributionType;

final class ContributionTypeTest extends TestCase
{
    public function test_backing_values_are_stable(): void
    {
        self::assertSame('review', ContributionType::Review->value);
        self::assertSame('photo', ContributionType::Photo->value);
        self::assertSame('starred', ContributionType::Starred->value);
        self::assertSame('question', ContributionType::Question->value);
    }

    public function test_can_be_reconstructed_from_its_backing_value(): void
    {
        self::assertSame(ContributionType::Review, ContributionType::from('review'));
        self::assertSame(ContributionType::Question, ContributionType::from('question'));
    }

    public function test_labels_are_human_readable_plurals(): void
    {
        self::assertSame('reviews', ContributionType::Review->label());
        self::assertSame('photos', ContributionType::Photo->label());
        self::assertSame('starred places', ContributionType::Starred->label());
        self::assertSame('questions', ContributionType::Question->label());
    }

    public function test_has_exactly_four_cases(): void
    {
        self::assertCount(4, ContributionType::cases());
    }
}

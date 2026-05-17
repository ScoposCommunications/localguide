<?php

declare(strict_types=1);

namespace GuideMap;

/**
 * The four kinds of Google Maps contribution GuideMap Pro recognizes.
 *
 * The backing string is the value persisted in the `type` column and is
 * stable: it is part of the storage contract, so changing it would orphan
 * existing rows.
 */
enum ContributionType: string
{
    case Review = 'review';
    case Photo = 'photo';
    case Starred = 'starred';
    case Question = 'question';

    /**
     * Human-readable plural label, used by the CLI summary and (later) the
     * WordPress UI.
     */
    public function label(): string
    {
        return match ($this) {
            self::Review => 'reviews',
            self::Photo => 'photos',
            self::Starred => 'starred places',
            self::Question => 'questions',
        };
    }
}

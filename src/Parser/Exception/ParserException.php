<?php

declare(strict_types=1);

namespace GuideMap\Parser\Exception;

use RuntimeException;

/**
 * Base type for every exception thrown by the parser layer.
 *
 * Catching this one type catches all fatal, whole-input parsing failures.
 * Per-file problems are not exceptions — they are collected as strings in
 * {@see \GuideMap\Parser\ParseResult::$errors}. See DECISIONS.md (D11).
 */
class ParserException extends RuntimeException
{
}

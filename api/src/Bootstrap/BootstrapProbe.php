<?php

declare(strict_types=1);

namespace App\Bootstrap;

/**
 * Temporary bootstrap-only helper to validate tooling (tests, coverage, Docker).
 * Replace with real domain code when implementing the API.
 */
final readonly class BootstrapProbe
{
    public function status(): string
    {
        return 'bootstrap';
    }

    /**
     * @return non-empty-string when $label is non-empty after trim
     */
    public function describe(string $label): string
    {
        $trimmed = trim($label);

        if ($trimmed === '') {
            return 'empty';
        }

        return 'ok:' . $trimmed;
    }
}

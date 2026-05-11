<?php

declare(strict_types=1);

use App\Env;

describe('Env', function (): void {
    test('string throws when unset', function (): void {
        $name = 'API_TEST_ENV_ABSENT_' . bin2hex(random_bytes(4));
        expect(fn (): string => Env::string($name))
            ->toThrow(\RuntimeException::class, 'Missing or empty environment variable: ' . $name);
    });

    test('stringOrNull returns null when unset', function (): void {
        $name = 'API_ENV_NULL_' . bin2hex(random_bytes(4));
        expect(Env::stringOrNull($name))->toBeNull();
    });

    test('int throws when value is not numeric', function (): void {
        $name = 'API_TEST_ENV_INT_BAD_' . bin2hex(random_bytes(4));
        putenv($name . '=not-a-number');
        try {
            expect(fn (): int => Env::int($name))
                ->toThrow(\RuntimeException::class, 'must be an integer');
        } finally {
            putenv($name);
        }
    });
});

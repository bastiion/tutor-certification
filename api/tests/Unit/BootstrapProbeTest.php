<?php

declare(strict_types=1);

use App\Bootstrap\BootstrapProbe;

describe('BootstrapProbe', function (): void {
    test('reports bootstrap status', function (): void {
        $probe = new BootstrapProbe();

        expect($probe->status())->toBe('bootstrap');
    });

    test('describe returns empty label for whitespace-only input', function (): void {
        $probe = new BootstrapProbe();

        expect($probe->describe(''))->toBe('empty');
        expect($probe->describe('   '))->toBe('empty');
    });

    test('describe prefixes trimmed non-empty labels', function (): void {
        $probe = new BootstrapProbe();

        expect($probe->describe('hello'))->toBe('ok:hello');
        expect($probe->describe('  spaced  '))->toBe('ok:spaced');
    });
});

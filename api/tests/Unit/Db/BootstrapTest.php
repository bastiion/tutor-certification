<?php

declare(strict_types=1);

use App\Db\Bootstrap;

describe('Db\\Bootstrap', function (): void {
    test('creates sqlite file and applies schema idempotently', function (): void {
        $apiRoot = dirname(__DIR__, 3);
        $sqlite = tempnam(sys_get_temp_dir(), 'api-sqlite-');
        expect($sqlite)->not->toBeFalse();
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $boot = new Bootstrap($apiRoot);
            $pdo1 = $boot->createPdo();
            $pdo1->query('SELECT 1 FROM sessions');

            $pdo2 = $boot->createPdo();
            $pdo2->query('SELECT 1 FROM revocations');

            expect(true)->toBeTrue();
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('databasePath defaults to apiRoot/db/certs.sqlite without API_SQLITE_PATH', function (): void {
        $apiRoot = dirname(__DIR__, 3);
        $had = getenv('API_SQLITE_PATH');
        putenv('API_SQLITE_PATH');
        unset($_ENV['API_SQLITE_PATH']);

        try {
            $boot = new Bootstrap($apiRoot);
            expect($boot->databasePath())->toBe($apiRoot . '/db/certs.sqlite');
        } finally {
            if ($had !== false && $had !== '') {
                putenv('API_SQLITE_PATH=' . $had);
                $_ENV['API_SQLITE_PATH'] = $had;
            }
        }
    });

    test('createPdo throws when schema file is missing', function (): void {
        $root = sys_get_temp_dir() . '/api-no-schema-' . bin2hex(random_bytes(4));
        mkdir($root . '/db', 0o775, true);
        $sqlite = $root . '/db/test.sqlite';
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        $boot = new Bootstrap($root);
        try {
            expect(fn (): \PDO => $boot->createPdo())->toThrow(\RuntimeException::class, 'Schema file');
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
            if (is_file($root . '/db/schema.sql')) {
                @unlink($root . '/db/schema.sql');
            }
            @rmdir($root . '/db');
            @rmdir($root);
        }
    });

    test('createPdo throws when schema file is empty', function (): void {
        $root = sys_get_temp_dir() . '/api-empty-schema-' . bin2hex(random_bytes(4));
        mkdir($root . '/db', 0o775, true);
        file_put_contents($root . '/db/schema.sql', '');
        $sqlite = $root . '/db/test.sqlite';
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        $boot = new Bootstrap($root);
        try {
            expect(fn (): \PDO => $boot->createPdo())->toThrow(\RuntimeException::class, 'Schema file empty');
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
            @unlink($root . '/db/schema.sql');
            @rmdir($root . '/db');
            @rmdir($root);
        }
    });
});

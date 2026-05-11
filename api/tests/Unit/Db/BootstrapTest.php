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

        $boot = new Bootstrap($apiRoot);
        $pdo1 = $boot->createPdo();
        $pdo1->query('SELECT 1 FROM sessions');

        $pdo2 = $boot->createPdo();
        $pdo2->query('SELECT 1 FROM revocations');

        expect(true)->toBeTrue();
    });
});

<?php

declare(strict_types=1);

namespace Tests\Unit\Repository;

use App\Domain\RevocationDocument;
use App\Repository\RevocationRepository;
use PDO;

describe('RevocationRepository', function (): void {
    test('insert and find', function (): void {
        $pdo = memorySchemaPdoRevocation();
        $repo = new RevocationRepository($pdo);
        $doc = RevocationDocument::fromArray([
            'cert_id' => '018f5b2e-4b2a-7000-9000-abcdef123456',
            'revoked_at' => '2026-05-11T12:00:00Z',
            'reason' => 'test',
            'signature' => sodium_bin2base64(random_bytes(64), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING),
            'schema_version' => 1,
        ]);
        $repo->insert($doc);
        $found = $repo->findByCertId($doc->certId);
        expect($found)->not->toBeNull()
            ->and($found->reason)->toBe('test');
    });

    test('duplicate revocation fails', function (): void {
        $pdo = memorySchemaPdoRevocation();
        $repo = new RevocationRepository($pdo);
        $doc = RevocationDocument::fromArray([
            'cert_id' => '038f5b2e-4b2a-7000-9000-abcdef123456',
            'revoked_at' => '2026-05-11T12:00:00Z',
            'reason' => 'test',
            'signature' => sodium_bin2base64(random_bytes(64), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING),
            'schema_version' => 1,
        ]);
        $repo->insert($doc);
        expect(fn () => $repo->insert($doc))->toThrow(\RuntimeException::class);
    });
});

function memorySchemaPdoRevocation(): PDO
{
    $pdo = new PDO('sqlite::memory:', options: [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    $schema = file_get_contents(dirname(__DIR__, 3) . '/db/schema.sql');
    $pdo->exec((string) $schema);

    return $pdo;
}

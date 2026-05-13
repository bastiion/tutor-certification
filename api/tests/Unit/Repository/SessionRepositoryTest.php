<?php

declare(strict_types=1);

namespace Tests\Unit\Repository;

use App\Crypto\Signer;
use App\Domain\SessionCredential;
use App\Repository\SessionRepository;
use PDO;
use Tests\Support\SessionCredentialFixture;

describe('SessionRepository', function (): void {
    test('insert and find', function (): void {
        $pdo = memorySchemaPdo();
        $signer = new Signer();
        $repo = new SessionRepository($pdo, $signer);
        $box = sodium_crypto_box_keypair();

        $payload = SessionCredentialFixture::validArray($signer, $box, '018f5b2e-4b2a-7000-9000-abcdef123456', time() + 3600);
        $cred = SessionCredential::fromArray($payload);
        $repo->insert($cred);

        $row = $repo->findByCourseId($cred->courseId);
        expect($row)->not->toBeNull()
            ->and($row->courseId)->toBe($cred->courseId);
    });

    test('duplicate insert fails', function (): void {
        $pdo = memorySchemaPdo();
        $signer = new Signer();
        $repo = new SessionRepository($pdo, $signer);
        $box = sodium_crypto_box_keypair();
        $payload = SessionCredentialFixture::validArray($signer, $box, '028f5b2e-4b2a-7000-9000-abcdef123456', time() + 3600);
        $cred = SessionCredential::fromArray($payload);
        $repo->insert($cred);
        expect(fn () => $repo->insert($cred))->toThrow(\RuntimeException::class);
    });

});

function memorySchemaPdo(): PDO
{
    $pdo = new PDO('sqlite::memory:', options: [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    ]);
    $schemaPath = dirname(__DIR__, 3) . '/db/schema.sql';
    $schema = file_get_contents($schemaPath);
    expect($schema)->not->toBeFalse();
    $pdo->exec((string) $schema);

    return $pdo;
}

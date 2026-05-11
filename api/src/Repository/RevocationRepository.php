<?php

declare(strict_types=1);

namespace App\Repository;

use App\Domain\RevocationDocument;
use PDO;
use PDOException;

final class RevocationRepository
{
    public function __construct(
        private readonly PDO $pdo,
    ) {}

    public function insert(RevocationDocument $doc): void
    {
        $sql = <<<'SQL'
            INSERT INTO revocations (cert_id, revoked_at, reason, signature)
            VALUES (:cert_id, :revoked_at, :reason, :signature)
            SQL;

        $stmt = $this->pdo->prepare($sql);
        try {
            $stmt->execute([
                ':cert_id' => $doc->certId,
                ':revoked_at' => $doc->revokedAt,
                ':reason' => $doc->reason,
                ':signature' => $doc->signatureBase64Url,
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000' || str_contains($e->getMessage(), 'UNIQUE')) {
                throw new \RuntimeException('Revocation already exists', 0, $e);
            }

            throw $e;
        }
    }

    public function findByCertId(string $certId): ?RevocationDocument
    {
        $stmt = $this->pdo->prepare(
            'SELECT cert_id, revoked_at, reason, signature FROM revocations WHERE cert_id = :id LIMIT 1',
        );
        $stmt->execute([':id' => $certId]);
        /** @var array<string, mixed>|false $row */
        $row = $stmt->fetch();
        if ($row === false) {
            return null;
        }

        return new RevocationDocument(
            certId: (string) $row['cert_id'],
            revokedAt: (string) $row['revoked_at'],
            reason: (string) $row['reason'],
            signatureBase64Url: (string) $row['signature'],
        );
    }
}

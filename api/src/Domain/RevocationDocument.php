<?php

declare(strict_types=1);

namespace App\Domain;

use OpenApi\Attributes as OA;

#[OA\Schema(
    schema: 'RevocationDocument',
    required: ['cert_id', 'revoked_at', 'reason', 'signature']
)]
final readonly class RevocationDocument
{
    public function __construct(
        #[OA\Property(format: 'uuid')]
        public string $certId,
        public string $revokedAt,
        public string $reason,
        #[OA\Property(description: 'Detached Ed25519 revocation signature (Base64URL), message = cert_id ‖ revoked_at UTF-8')]
        public string $signatureBase64Url,
    ) {}

    /** Canonical signed byte string per product concept. */
    public function signedMessageUtf8(): string
    {
        return $this->certId . $this->revokedAt;
    }

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        $allowed = [
            'cert_id' => true,
            'revoked_at' => true,
            'reason' => true,
            'signature' => true,
        ];

        foreach (array_diff_key($data, $allowed) as $k => $_) {
            throw new \InvalidArgumentException('Unexpected field in revocation document: ' . (string) $k);
        }

        foreach (array_diff_key($allowed, $data) as $k => $_) {
            throw new \InvalidArgumentException('Missing revocation field: ' . $k);
        }

        foreach (['cert_id', 'revoked_at', 'reason', 'signature'] as $k) {
            if (! is_string($data[$k]) || $data[$k] === '') {
                throw new \InvalidArgumentException($k . ' must be non-empty string');
            }
        }

        return new self(
            certId: (string) $data['cert_id'],
            revokedAt: (string) $data['revoked_at'],
            reason: (string) $data['reason'],
            signatureBase64Url: (string) $data['signature'],
        );
    }

    /**
     * @return array{cert_id: string, revoked_at: string, reason: string, signature: string}
     */
    public function toArray(): array
    {
        return [
            'cert_id' => $this->certId,
            'revoked_at' => $this->revokedAt,
            'reason' => $this->reason,
            'signature' => $this->signatureBase64Url,
        ];
    }
}

<?php

declare(strict_types=1);

use App\Domain\RevocationDocument;

describe('RevocationDocument', function (): void {
    test('fromArray round-trip toArray', function (): void {
        $doc = RevocationDocument::fromArray([
            'cert_id' => '018f5b2e-4b2a-7000-9000-abcdef123456',
            'revoked_at' => '2026-05-11T12:00:00Z',
            'reason' => 'fraud',
            'signature' => sodium_bin2base64(random_bytes(64), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING),
        ]);

        expect($doc->signedMessageUtf8())->toBe($doc->certId . $doc->revokedAt);
        expect($doc->toArray()['cert_id'])->toBe($doc->certId);
    });

    test('rejects unexpected keys', function (): void {
        $base = [
            'cert_id' => '018f5b2e-4b2a-7000-9000-abcdef123456',
            'revoked_at' => '2026-05-11T12:00:00Z',
            'reason' => 'x',
            'signature' => sodium_bin2base64(random_bytes(64), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING),
            'extra' => 1,
        ];
        expect(fn () => RevocationDocument::fromArray($base))->toThrow(\InvalidArgumentException::class, 'Unexpected field');
    });

    test('rejects missing field', function (): void {
        $base = [
            'cert_id' => '018f5b2e-4b2a-7000-9000-abcdef123456',
            'revoked_at' => '2026-05-11T12:00:00Z',
            'reason' => 'x',
        ];
        expect(fn () => RevocationDocument::fromArray($base))->toThrow(\InvalidArgumentException::class, 'Missing revocation field');
    });

    test('rejects empty cert_id string', function (): void {
        $base = [
            'cert_id' => '',
            'revoked_at' => '2026-05-11T12:00:00Z',
            'reason' => 'x',
            'signature' => sodium_bin2base64(random_bytes(64), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING),
        ];
        expect(fn () => RevocationDocument::fromArray($base))->toThrow(\InvalidArgumentException::class, 'cert_id');
    });

    test('rejects non-string reason', function (): void {
        $base = [
            'cert_id' => '018f5b2e-4b2a-7000-9000-abcdef123456',
            'revoked_at' => '2026-05-11T12:00:00Z',
            'reason' => 99,
            'signature' => sodium_bin2base64(random_bytes(64), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING),
        ];
        expect(fn () => RevocationDocument::fromArray($base))->toThrow(\InvalidArgumentException::class, 'reason');
    });
});

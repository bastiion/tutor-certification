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
});

<?php

declare(strict_types=1);

use App\Domain\SessionCredential;

describe('SessionCredential', function (): void {
    $minimal = static fn (): array => [
        'course_id' => '018f5b2e-4b2a-7000-9000-abcdef123456',
        'valid_until' => 2000000000,
        'course_title' => 'T',
        'course_date' => '2026-01-01',
        'institute_name' => 'I',
        'tutor_email' => 't@example.test',
        'K_master_public' => sodium_bin2base64(random_bytes(32), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING),
        'K_course_public' => sodium_bin2base64(random_bytes(32), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING),
        'K_master_public_fingerprint' => str_repeat('a', 64),
        'session_sig' => sodium_bin2base64(random_bytes(64), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING),
        'K_course_private_enc' => sodium_bin2base64(random_bytes(80), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING),
    ];

    test('rejects extra keys', function () use ($minimal): void {
        $base = $minimal();
        $base['extra'] = 1;
        expect(fn () => SessionCredential::fromArray($base))->toThrow(\InvalidArgumentException::class);
    });

    test('rejects missing field', function () use ($minimal): void {
        $base = $minimal();
        unset($base['course_title']);
        expect(fn () => SessionCredential::fromArray($base))->toThrow(\InvalidArgumentException::class);
    });

    test('rejects valid_until that is not an integral number', function () use ($minimal): void {
        $base = $minimal();
        $base['valid_until'] = 1.5;
        expect(fn () => SessionCredential::fromArray($base))->toThrow(\InvalidArgumentException::class);
    });

    test('rejects negative valid_until', function () use ($minimal): void {
        $base = $minimal();
        $base['valid_until'] = -1;
        expect(fn () => SessionCredential::fromArray($base))->toThrow(\InvalidArgumentException::class);
    });

    test('rejects whitespace-only course_id', function () use ($minimal): void {
        $base = $minimal();
        $base['course_id'] = " \t ";
        expect(fn () => SessionCredential::fromArray($base))->toThrow(\InvalidArgumentException::class);
    });

    test('rejects valid_until that is not numeric', function () use ($minimal): void {
        $base = $minimal();
        $base['valid_until'] = '2030';
        expect(fn () => SessionCredential::fromArray($base))->toThrow(\InvalidArgumentException::class);
    });

    test('rejects non-string course_title', function () use ($minimal): void {
        $base = $minimal();
        $base['course_title'] = 123;
        expect(fn () => SessionCredential::fromArray($base))->toThrow(\InvalidArgumentException::class, 'course_title');
    });

    test('rejects empty K_course_public', function () use ($minimal): void {
        $base = $minimal();
        $base['K_course_public'] = '';
        expect(fn () => SessionCredential::fromArray($base))->toThrow(\InvalidArgumentException::class, 'K_course_public');
    });

    test('rejects non-string fingerprint', function () use ($minimal): void {
        $base = $minimal();
        $base['K_master_public_fingerprint'] = 12345;
        expect(fn () => SessionCredential::fromArray($base))->toThrow(\InvalidArgumentException::class, 'K_master_public_fingerprint');
    });

    test('rejects fingerprint with invalid hex length', function () use ($minimal): void {
        $base = $minimal();
        $base['K_master_public_fingerprint'] = str_repeat('b', 63);
        expect(fn () => SessionCredential::fromArray($base))->toThrow(\InvalidArgumentException::class, '64 hex');
    });

    test('normalizes uppercase fingerprint hex to lowercase', function () use ($minimal): void {
        $base = $minimal();
        $hex = str_repeat('b', 60) . 'cafe';
        $base['K_master_public_fingerprint'] = strtoupper($hex);
        $cred = SessionCredential::fromArray($base);
        expect($cred->kMasterPublicFingerprintHex)->toBe(strtolower($hex));
    });
});

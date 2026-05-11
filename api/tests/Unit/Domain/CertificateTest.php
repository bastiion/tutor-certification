<?php

declare(strict_types=1);

use App\Domain\Certificate;

describe('Certificate', function (): void {
    /**
     * @return array{id: non-empty-string, title: string, date: non-empty-string}
     */
    function mkCourse(): array
    {
        return [
            'id' => '208f5b2e-4b2a-7000-9000-abcdef123456',
            'title' => 'Title',
            'date' => '2026-05-11',
        ];
    }

    /**
     * @return array{name: non-empty-string, email?: string}
     */
    function mkParticipant(): array
    {
        return ['name' => 'Ada'];
    }

    /**
     * @return array{name: non-empty-string, key_fingerprint: non-empty-string}
     */
    function mkInstitute(): array
    {
        return ['name' => 'Institute', 'key_fingerprint' => str_repeat('a', 64)];
    }

    test('includes K_master_public before K_course_public in signing JSON', function (): void {
        $kp = sodium_bin2base64(random_bytes(32), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);

        $c = new Certificate(
            certId: '058f5b2e-4b2a-7000-9000-abcdef123456',
            version: 1,
            issuedAt: '2026-05-11T12:00:00+00:00',
            course: mkCourse(),
            participant: mkParticipant(),
            institute: mkInstitute(),
            kMasterPublicBase64Url: $kp,
            kCoursePublicBase64Url: sodium_bin2base64(random_bytes(32), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING),
            sessionSigBase64Url: sodium_bin2base64(random_bytes(SODIUM_CRYPTO_SIGN_BYTES), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING),
            certificateSigBase64Url: '',
        );

        /** @var array<string, mixed> $blob */
        $blob = json_decode($c->toSigningJson(), true, flags: JSON_THROW_ON_ERROR);
        expect(array_keys($blob))->toBe([
            'cert_id',
            'version',
            'issued_at',
            'course',
            'participant',
            'institute',
            'K_master_public',
            'K_course_public',
            'session_sig',
        ]);
        expect($blob['K_master_public'] ?? null)->toBe($kp);
    });

    test('response JSON includes certificate_sig last and embeds master public key', function (): void {
        $km = sodium_bin2base64(random_bytes(32), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
        $kc = sodium_bin2base64(random_bytes(32), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
        $ss = sodium_bin2base64(random_bytes(SODIUM_CRYPTO_SIGN_BYTES), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
        $cs = sodium_bin2base64(random_bytes(SODIUM_CRYPTO_SIGN_BYTES), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);

        $c = new Certificate(
            certId: '068f5b2e-4b2a-7000-9000-abcdef123456',
            version: 1,
            issuedAt: '2026-05-11T12:01:00+00:00',
            course: mkCourse(),
            participant: mkParticipant(),
            institute: mkInstitute(),
            kMasterPublicBase64Url: $km,
            kCoursePublicBase64Url: $kc,
            sessionSigBase64Url: $ss,
            certificateSigBase64Url: $cs,
        );

        /** @var array<string, mixed> $blob */
        $blob = json_decode($c->toResponseJson(), true, flags: JSON_THROW_ON_ERROR);

        expect($blob['K_master_public'] ?? null)->toBe($km);
        expect($blob['K_course_public'] ?? null)->toBe($kc);

        expect(array_keys($blob))->toBe([
            'cert_id',
            'version',
            'issued_at',
            'course',
            'participant',
            'institute',
            'K_master_public',
            'K_course_public',
            'session_sig',
            'certificate_sig',
        ]);
        expect(array_key_last($blob))->toBe('certificate_sig');

        expect($c->withCertificateSig($cs))->toBeInstanceOf(Certificate::class);
    });

    test('participant email appears in JSON slices when present', function (): void {
        $km = sodium_bin2base64(random_bytes(32), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
        $kc = sodium_bin2base64(random_bytes(32), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
        $ss = sodium_bin2base64(random_bytes(SODIUM_CRYPTO_SIGN_BYTES), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);

        $c = new Certificate(
            certId: '078f5b2e-4b2a-7000-9000-abcdef123456',
            version: 1,
            issuedAt: '2026-05-11T12:02:00+00:00',
            course: mkCourse(),
            participant: ['name' => 'Ada', 'email' => 'ada@example.test'],
            institute: mkInstitute(),
            kMasterPublicBase64Url: $km,
            kCoursePublicBase64Url: $kc,
            sessionSigBase64Url: $ss,
            certificateSigBase64Url: '',
        );

        /** @var array{participant: array{name: string, email?: string}} $signing */
        $signing = json_decode($c->toSigningJson(), true, flags: JSON_THROW_ON_ERROR);
        expect($signing['participant']['email'] ?? null)->toBe('ada@example.test');

        $withSig = $c->withCertificateSig(sodium_bin2base64(random_bytes(SODIUM_CRYPTO_SIGN_BYTES), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING));
        /** @var array{participant: array{name: string, email?: string}} $resp */
        $resp = json_decode($withSig->toResponseJson(), true, flags: JSON_THROW_ON_ERROR);
        expect($resp['participant']['email'] ?? null)->toBe('ada@example.test');
    });
});

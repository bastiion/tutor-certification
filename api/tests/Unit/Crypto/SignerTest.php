<?php

declare(strict_types=1);

use App\Crypto\Signer;

/** @return non-empty-string */
function cryptoTestVectorsDir(): string
{
    $apiRoot = dirname(__DIR__, 3);
    $candidates = [
        $apiRoot . '/packages-crypto-test-vectors',
        dirname($apiRoot) . '/packages/crypto/test-vectors',
    ];
    foreach ($candidates as $dir) {
        if (is_dir($dir)) {
            return $dir;
        }
    }

    throw new \RuntimeException('Crypto test vectors directory not found (expected Docker mount or repo packages/crypto/test-vectors)');
}

describe('Signer', function (): void {
    test('HKDF vectors match packages/crypto test fixtures', function (): void {
        $signer = new Signer();
        $vectors = cryptoTestVectorsDir();
        foreach (glob($vectors . '/hkdf-cert-course-key-*.json') ?: [] as $path) {
            $json = json_decode((string) file_get_contents($path), true, flags: JSON_THROW_ON_ERROR);
            $ikm = sodium_base642bin($json['ikm_b64'], SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
            $okm = $signer->deriveSessionSeed($ikm, $json['course_id'], (int) $json['valid_until_unix']);
            $expected = sodium_base642bin($json['expected_okm_b64'], SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
            expect($okm)->toBe($expected);
        }
    });

    test('Ed25519 RFC8032 vector verifies', function (): void {
        $signer = new Signer();
        $vectors = cryptoTestVectorsDir();
        $json = json_decode((string) file_get_contents($vectors . '/ed25519-rfc8032-001.json'), true, flags: JSON_THROW_ON_ERROR);
        $seed = sodium_base642bin($json['seed_b64'], SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
        $kp = sodium_crypto_sign_seed_keypair($seed);
        $pk = sodium_crypto_sign_publickey($kp);
        $expectedPk = sodium_base642bin($json['expected_pk_b64'], SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
        expect($pk)->toBe($expectedPk);

        $message = sodium_base642bin($json['message_b64'], SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
        $sig = sodium_base642bin($json['expected_signature_b64'], SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
        expect($signer->verifyDetached($message, $sig, $pk))->toBeTrue();
    });

    test('base64url round-trip matches RFC4648 fixture strings', function (): void {
        $signer = new Signer();
        $vectors = cryptoTestVectorsDir();
        $json = json_decode((string) file_get_contents($vectors . '/base64url-rfc4648.json'), true, flags: JSON_THROW_ON_ERROR);
        foreach ($json['round_trips_utf8_to_b64url'] as $row) {
            $utf8 = $row['utf8'];
            $expected = $row['expected_b64url'];
            $enc = $signer->base64UrlEncode($utf8);
            expect($enc)->toBe($expected);
            if ($expected !== '') {
                expect($signer->base64UrlDecode($enc))->toBe($utf8);
            }
        }
    });

    test('sealed box round-trip', function (): void {
        $signer = new Signer();
        $kp = sodium_crypto_box_keypair();
        $pk = sodium_crypto_box_publickey($kp);
        $plain = 'secret-course-key';
        $ct = $signer->boxSeal($plain, $pk);
        $opened = $signer->boxSealOpen($ct, $kp);
        expect($opened)->toBe($plain);
    });

    test('deriveSessionSeed rejects negative valid_until', function (): void {
        $signer = new Signer();
        expect(fn (): string => $signer->deriveSessionSeed(random_bytes(32), 'c', -1))
            ->toThrow(\InvalidArgumentException::class);
    });

    test('ed25519SecretKeyFromSeed expands to libsodium secret key format', function (): void {
        $signer = new Signer();
        $seed = random_bytes(32);
        $sk64 = $signer->ed25519SecretKeyFromSeed($seed);
        expect(strlen($sk64))->toBe(SODIUM_CRYPTO_SIGN_SECRETKEYBYTES)
            ->and(strlen($signer->ed25519PublicKeyFromSecretKey($sk64)))->toBe(SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES);
    });

    test('boxSealOpen returns false for ciphertext sealed to a different keypair', function (): void {
        $signer = new Signer();
        $kpA = sodium_crypto_box_keypair();
        $kpB = sodium_crypto_box_keypair();
        $pkA = sodium_crypto_box_publickey($kpA);
        $ct = $signer->boxSeal('plaintext', $pkA);
        assert($ct !== '');
        $kpB64 = sodium_crypto_box_secretkey($kpB) . sodium_crypto_box_publickey($kpB);
        expect($signer->boxSealOpen($ct, $kpB64))->toBeFalse();
    });
});

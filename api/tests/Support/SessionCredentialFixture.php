<?php

declare(strict_types=1);

namespace Tests\Support;

use App\Crypto\Signer;

/** Builds a JSON-ready session credential payload matching tutor + server crypto rules. */
final class SessionCredentialFixture
{
    /**
     * @return array<string, mixed>
     */
    public static function validArray(
        Signer $signer,
        string $serverBoxKeypair64,
        string $courseId,
        int $validUntilUnix,
    ): array {
        $masterSeed = random_bytes(32);
        $masterKp = sodium_crypto_sign_seed_keypair($masterSeed);
        $masterPk = sodium_crypto_sign_publickey($masterKp);
        $masterSk = sodium_crypto_sign_secretkey($masterKp);

        $courseSeed = $signer->deriveSessionSeed($masterSeed, $courseId, $validUntilUnix);
        $courseKp = sodium_crypto_sign_seed_keypair($courseSeed);
        $coursePk = sodium_crypto_sign_publickey($courseKp);
        $courseSk = sodium_crypto_sign_secretkey($courseKp);

        $msg = $signer->sessionEndorsementMessage($courseId, $validUntilUnix, $coursePk);
        $sig = sodium_crypto_sign_detached($msg, $masterSk);

        $serverPk = sodium_crypto_box_publickey($serverBoxKeypair64);
        $enc = sodium_crypto_box_seal($courseSk, $serverPk);

        return [
            'course_id' => $courseId,
            'valid_until' => $validUntilUnix,
            'course_title' => 'E2E Kurs',
            'course_date' => '2026-05-11',
            'institute_name' => 'Example Institute',
            'K_master_public' => $signer->base64UrlEncode($masterPk),
            'K_course_public' => $signer->base64UrlEncode($coursePk),
            'K_master_public_fingerprint' => $signer->masterPublicFingerprintHex($masterPk),
            'session_sig' => $signer->base64UrlEncode($sig),
            'K_course_private_enc' => $signer->base64UrlEncode($enc),
        ];
    }

    /**
     * Same as {@see validArray}, plus the libsodium Ed25519 secret key (64 bytes) for tutor-signed revocation tests.
     *
     * @return array{credential: array<string, mixed>, master_secret_key_64: non-empty-string}
     */
    public static function validArrayWithSecrets(
        Signer $signer,
        string $serverBoxKeypair64,
        string $courseId,
        int $validUntilUnix,
    ): array {
        $masterSeed = random_bytes(32);
        $masterKp = sodium_crypto_sign_seed_keypair($masterSeed);
        $masterPk = sodium_crypto_sign_publickey($masterKp);
        $masterSk = sodium_crypto_sign_secretkey($masterKp);

        $courseSeed = $signer->deriveSessionSeed($masterSeed, $courseId, $validUntilUnix);
        $courseKp = sodium_crypto_sign_seed_keypair($courseSeed);
        $coursePk = sodium_crypto_sign_publickey($courseKp);
        $courseSk = sodium_crypto_sign_secretkey($courseKp);

        $msg = $signer->sessionEndorsementMessage($courseId, $validUntilUnix, $coursePk);
        $sig = sodium_crypto_sign_detached($msg, $masterSk);

        $serverPk = sodium_crypto_box_publickey($serverBoxKeypair64);
        $enc = sodium_crypto_box_seal($courseSk, $serverPk);

        $credential = [
            'course_id' => $courseId,
            'valid_until' => $validUntilUnix,
            'course_title' => 'E2E Kurs',
            'course_date' => '2026-05-11',
            'institute_name' => 'Example Institute',
            'K_master_public' => $signer->base64UrlEncode($masterPk),
            'K_course_public' => $signer->base64UrlEncode($coursePk),
            'K_master_public_fingerprint' => $signer->masterPublicFingerprintHex($masterPk),
            'session_sig' => $signer->base64UrlEncode($sig),
            'K_course_private_enc' => $signer->base64UrlEncode($enc),
        ];

        return [
            'credential' => $credential,
            'master_secret_key_64' => $masterSk,
        ];
    }
}

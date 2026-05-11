<?php

declare(strict_types=1);

namespace App\Crypto;

/**
 * libsodium wrappers: HKDF (PHP hash_hkdf), Ed25519, sealed box, Base64URL.
 */
final class Signer
{
    /**
     * Per-session HKDF-SHA256 output (32-byte Ed25519 seed material).
     *
     * info matches JS {@see \App\...\buildCertCourseHkdfInfo}:
     * utf8('cert-course-key') ‖ utf8(courseId) ‖ big-endian u64(validUntil).
     *
     * @param non-empty-string $ikm  raw K_master private seed bytes (typically 32)
     *
     * @return non-empty-string 32-byte OKM
     */
    public function deriveSessionSeed(string $ikm, string $courseId, int $validUntilUnix): string
    {
        if ($validUntilUnix < 0) {
            throw new \InvalidArgumentException('valid_until must be non-negative');
        }

        $info = $this->buildCertCourseHkdfInfoBytes($courseId, $validUntilUnix);
        $okm = hash_hkdf('sha256', $ikm, 32, $info, '');
        if ($okm === false || strlen($okm) !== 32) {
            throw new \RuntimeException('HKDF failed');
        }

        return $okm;
    }

    /**
     * @return non-empty-string
     */
    public function buildCertCourseHkdfInfoBytes(string $courseId, int $validUntilUnix): string
    {
        return 'cert-course-key' . $courseId . pack('J', $validUntilUnix);
    }

    /**
     * Session endorsement message: course_id ‖ valid_until_be_u64 ‖ K_course_public (raw).
     *
     * @param non-empty-string $kCoursePublicRaw 32-byte Ed25519 public key
     *
     * @return non-empty-string
     */
    public function sessionEndorsementMessage(string $courseId, int $validUntilUnix, string $kCoursePublicRaw): string
    {
        return $courseId . pack('J', $validUntilUnix) . $kCoursePublicRaw;
    }

    /** @param non-empty-string $message */
    public function signDetached(string $message, string $ed25519SecretKey64): string
    {
        return sodium_crypto_sign_detached($message, $ed25519SecretKey64);
    }

    /** @param non-empty-string $message */
    public function verifyDetached(string $message, string $signature64, string $ed25519PublicKey32): bool
    {
        return sodium_crypto_sign_verify_detached($signature64, $message, $ed25519PublicKey32);
    }

    /**
     * @param non-empty-string $seed32
     *
     * @return non-empty-string 64-byte Ed25519 secret key (seed ‖ pk)
     */
    public function ed25519SecretKeyFromSeed(string $seed32): string
    {
        $kp = sodium_crypto_sign_seed_keypair($seed32);

        return sodium_crypto_sign_secretkey($kp);
    }

    /**
     * @param non-empty-string $secretKey64
     *
     * @return non-empty-string 32-byte public key
     */
    public function ed25519PublicKeyFromSecretKey(string $secretKey64): string
    {
        return sodium_crypto_sign_publickey_from_secretkey($secretKey64);
    }

    /** @param non-empty-string $plaintext */
    public function boxSeal(string $plaintext, string $recipientX25519PublicKey32): string
    {
        return sodium_crypto_box_seal($plaintext, $recipientX25519PublicKey32);
    }

    /**
     * @param non-empty-string $ciphertext
     *
     * @return non-empty-string|false
     */
    public function boxSealOpen(string $ciphertext, string $serverBoxKeypair64): string|false
    {
        return sodium_crypto_box_seal_open($ciphertext, $serverBoxKeypair64);
    }

    /**
     * @param non-empty-string $binary
     */
    public function base64UrlEncode(string $binary): string
    {
        return sodium_bin2base64($binary, SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
    }

    /**
     * @return non-empty-string
     */
    public function base64UrlDecode(string $b64url): string
    {
        return sodium_base642bin($b64url, SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
    }

    /**
     * Fingerprint of Ed25519 master public key: BLAKE2b-256 / libsodium
     * `crypto_generichash` default size (lowercase hex, 64 chars).
     *
     * @param non-empty-string $ed25519PublicKey32
     */
    public function masterPublicFingerprintHex(string $ed25519PublicKey32): string
    {
        return bin2hex(sodium_crypto_generichash($ed25519PublicKey32));
    }
}

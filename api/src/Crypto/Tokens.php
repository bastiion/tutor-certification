<?php

declare(strict_types=1);

namespace App\Crypto;

/**
 * Stateless enrollment token: base64url(course_id ‖ u64_be ‖ HMAC_SHA256(secret, course_id ‖ u64_be)).
 */
final class Tokens
{
    public function __construct(
        private readonly string $hmacKey32,
        private readonly Signer $signer,
    ) {
        if (strlen($this->hmacKey32) !== SODIUM_CRYPTO_AUTH_KEYBYTES) {
            throw new \InvalidArgumentException('TOKEN_HMAC key must be 32 bytes');
        }
    }

    /**
     * @return non-empty-string URL-safe enrollment token (opaque)
     */
    public function generate(string $courseId, int $validUntilUnix): string
    {
        $payload = $this->bindingPayload($courseId, $validUntilUnix);
        $mac = hash_hmac('sha256', $payload, $this->hmacKey32, true);
        if ($mac === false || strlen($mac) !== 32) {
            throw new \RuntimeException('HMAC compute failed');
        }

        return $this->signer->base64UrlEncode($payload . $mac);
    }

    /**
     * Validates HMAC and parses payload. Returns claims even when expired (caller returns 410).
     *
     * @return array{course_id: string, valid_until_unix: int}|null
     */
    public function parseIfMacValid(string $tokenBase64Url): ?array
    {
        try {
            $raw = $this->signer->base64UrlDecode($tokenBase64Url);
        } catch (\Throwable) {
            return null;
        }

        if (strlen($raw) < 8 + 32) {
            return null;
        }

        $mac = substr($raw, -32);
        $rest = substr($raw, 0, -32);
        if ($rest === '') {
            return null;
        }

        $validUntilPacked = substr($rest, -8);
        $courseId = substr($rest, 0, -8);

        if ($courseId === '' || strlen($validUntilPacked) !== 8) {
            return null;
        }

        /** @phpstan-ignore-next-line argument unpacking */
        $validUntilUnpack = unpack('Jvalid', $validUntilPacked);
        if (! is_array($validUntilUnpack) || ! isset($validUntilUnpack['valid'])) {
            return null;
        }

        $validUntil = (int) $validUntilUnpack['valid'];

        if ($validUntil < 0) {
            return null;
        }

        $binding = $this->bindingPayload($courseId, $validUntil);
        $expected = hash_hmac('sha256', $binding, $this->hmacKey32, true);
        if ($expected === false || ! hash_equals($expected, $mac)) {
            return null;
        }

        return [
            'course_id' => $courseId,
            'valid_until_unix' => $validUntil,
        ];
    }

    /**
     * Fully valid enrollment token at $nowUnix (HMAC OK and not expired).
     *
     * @return array{course_id: string, valid_until_unix: int}|null
     */
    public function verify(string $tokenBase64Url, int $nowUnix): ?array
    {
        $claims = $this->parseIfMacValid($tokenBase64Url);
        if ($claims === null) {
            return null;
        }

        if ($nowUnix > $claims['valid_until_unix']) {
            return null;
        }

        return $claims;
    }

    /**
     * Payload bound by HMAC: utf8(course_id) ‖ pack('J', valid_until).
     *
     * @return non-empty-string
     */
    private function bindingPayload(string $courseId, int $validUntilUnix): string
    {
        return $courseId . pack('J', $validUntilUnix);
    }
}

<?php

declare(strict_types=1);

namespace App;

/**
 * Typed environment accessors (fail fast with clear messages).
 */
final class Env
{
    /**
     * @return non-empty-string
     */
    public static function string(string $name): string
    {
        $raw = getenv($name);
        if ($raw === false || $raw === '') {
            throw new \RuntimeException('Missing or empty environment variable: ' . $name);
        }

        return $raw;
    }

    /**
     * Optional string: returns null if unset or empty.
     */
    public static function stringOrNull(string $name): ?string
    {
        $raw = getenv($name);
        if ($raw === false || $raw === '') {
            return null;
        }

        return $raw;
    }

    public static function int(string $name): int
    {
        $raw = self::string($name);
        if (! is_numeric($raw)) {
            throw new \RuntimeException('Environment variable must be an integer: ' . $name);
        }

        return (int) $raw;
    }

    /**
     * Decode URL-safe Base64 without padding (same alphabet as sodium Base64 URLSAFE_NO_PADDING).
     *
     * @return non-empty-string raw bytes
     */
    public static function base64UrlDecode(string $name): string
    {
        $raw = self::string($name);
        $binary = sodium_base642bin($raw, SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);

        if ($binary === '') {
            throw new \RuntimeException('Decoded environment variable is empty: ' . $name);
        }

        return $binary;
    }
}

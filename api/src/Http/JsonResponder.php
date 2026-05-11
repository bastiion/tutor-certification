<?php

declare(strict_types=1);

namespace App\Http;

use Psr\Http\Message\ResponseInterface as Response;

/**
 * JSON response helpers.
 */
final class JsonResponder
{
    /**
     * Encode array/object to JSON response (no outer envelope).
     *
     * @param array<string, mixed> $payload
     */
    public static function json(Response $response, array $payload, int $status = 200): Response
    {
        try {
            $encoded = json_encode($payload, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (\JsonException $e) {
            throw new \RuntimeException('JSON encode failure', 0, $e);
        }

        $response->getBody()->write($encoded);

        return $response
            ->withStatus($status)
            ->withHeader('Content-Type', 'application/json; charset=utf-8');
    }

    public static function rawJson(Response $response, string $json, int $status = 200): Response
    {
        $response->getBody()->write($json);

        return $response
            ->withStatus($status)
            ->withHeader('Content-Type', 'application/json; charset=utf-8');
    }

    public static function error(Response $response, string $code, string $message, int $status): Response
    {
        $blob = ['error' => ['code' => $code, 'message' => $message]];
        try {
            $encoded = json_encode($blob, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (\JsonException $e) {
            throw new \RuntimeException('JSON encode failure', 0, $e);
        }

        $response->getBody()->write($encoded);

        return $response
            ->withStatus($status)
            ->withHeader('Content-Type', 'application/json; charset=utf-8');
    }
}

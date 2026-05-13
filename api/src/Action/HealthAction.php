<?php

declare(strict_types=1);

namespace App\Action;

use App\Http\JsonResponder;
use OpenApi\Attributes as OA;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

#[OA\Get(
    path: '/api/health',
    summary: 'Liveness/readiness probe',
    tags: ['meta'],
    responses: [
        new OA\Response(response: '200', description: 'Healthy'),
    ],
)]
final class HealthAction
{
    /** @param array<string, mixed> $args */
    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        unset($request, $args);

        return JsonResponder::json($response, [
            'ok' => true,
            'php' => PHP_VERSION,
            'app_version' => self::resolveAppVersion(),
            'schema_versions' => [
                'certificate' => 1,
                'revocation' => 1,
            ],
        ]);
    }

    private static function resolveAppVersion(): string
    {
        foreach (['APP_VERSION', 'GIT_SHA', 'GIT_COMMIT_SHA'] as $key) {
            $v = getenv($key);
            if (is_string($v)) {
                $t = trim($v);
                if ($t !== '') {
                    return $t;
                }
            }
        }

        return 'unknown';
    }
}

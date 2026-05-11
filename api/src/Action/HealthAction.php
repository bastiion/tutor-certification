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

        $build = getenv('GIT_SHA');
        $build = is_string($build) && trim($build) !== ''
            ? trim($build)
            : (function (): string {
                $c = getenv('GIT_COMMIT_SHA');
                if (is_string($c) && trim($c) !== '') {
                    return trim($c);
                }

                return 'unknown';
            })();

        return JsonResponder::json($response, [
            'ok' => true,
            'php' => PHP_VERSION,
            'build' => $build,
        ]);
    }
}

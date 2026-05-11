<?php

declare(strict_types=1);

namespace App\Action;

use App\Http\JsonResponder;
use Fig\Http\Message\StatusCodeInterface;
use OpenApi\Attributes as OA;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

#[OA\Get(
    path: '/api/openapi.json',
    summary: 'OpenAPI specification (generated, committed artefact)',
    tags: ['meta'],
    responses: [
        new OA\Response(response: '200', description: 'OpenAPI document'),
        new OA\Response(response: '503', description: 'Spec missing on disk'),
    ],
)]
final readonly class OpenApiAction
{
    /** @param non-empty-string $specAbsolutePath */
    public function __construct(
        private string $specAbsolutePath,
    ) {}

    /** @param array<string, mixed> $args */
    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        unset($request, $args);

        $path = $this->specAbsolutePath;
        if (! is_readable($path)) {
            return JsonResponder::error(
                $response,
                'spec_missing',
                'OpenAPI artefact missing. Run `bun run openapi:backend` locally and commit `api/public/openapi.json`.',
                StatusCodeInterface::STATUS_SERVICE_UNAVAILABLE,
            );
        }

        /** @var string|false $payload */
        $payload = file_get_contents($path);

        if ($payload === false || $payload === '') {
            return JsonResponder::error(
                $response,
                'spec_unreadable',
                'Could not read OpenAPI artefact from disk.',
                StatusCodeInterface::STATUS_SERVICE_UNAVAILABLE,
            );
        }

        return JsonResponder::rawJson($response, $payload)
            ->withHeader('Cache-Control', 'no-store');
    }
}

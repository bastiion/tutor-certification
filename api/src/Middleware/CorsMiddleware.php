<?php

declare(strict_types=1);

namespace App\Middleware;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Response;

/**
 * Opt-in CORS (development / split-origin tooling). Enabled when CORS_ALLOWED_ORIGINS lists allowed Origin values.
 */
final class CorsMiddleware implements MiddlewareInterface
{
    /**
     * @param list<non-empty-string> $allowedOrigins
     */
    public function __construct(
        private readonly array $allowedOrigins,
    ) {}

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $origin = $request->getHeaderLine('Origin');
        $reflected = $this->reflectAllowedOrigin($origin);

        if (strtoupper($request->getMethod()) === 'OPTIONS') {
            $response = new Response(204);

            return $this->applyCorsToResponse($request, $response, $reflected);
        }

        $response = $handler->handle($request);

        return $this->applyCorsToResponse($request, $response, $reflected);
    }

    private function reflectAllowedOrigin(string $origin): ?string
    {
        if ($origin === '') {
            return null;
        }

        foreach ($this->allowedOrigins as $allowed) {
            if ($origin === $allowed) {
                return $origin;
            }
        }

        return null;
    }

    private function applyCorsToResponse(
        ServerRequestInterface $request,
        ResponseInterface $response,
        ?string $allowOrigin,
    ): ResponseInterface {
        if ($allowOrigin === null) {
            return $response;
        }

        $requestHeaders = $request->getHeaderLine('Access-Control-Request-Headers');
        $allowHeaders = $requestHeaders !== ''
            ? $requestHeaders
            : 'Authorization, Content-Type, Accept';

        return $response
            ->withHeader('Access-Control-Allow-Origin', $allowOrigin)
            ->withHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            ->withHeader('Access-Control-Allow-Headers', $allowHeaders)
            ->withHeader('Access-Control-Max-Age', '86400')
            ->withHeader('Vary', 'Origin');
    }
}

<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Http\JsonResponder;
use Fig\Http\Message\StatusCodeInterface;
use Psr\Http\Message\ResponseFactoryInterface;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;

/** Enforces Authorization: Bearer for tutor routes (constant-time compare). */
final class BearerTokenMiddleware implements MiddlewareInterface
{
    /**
     * @param non-empty-string $expectedOpaqueToken Env `TUTOR_API_TOKEN`
     */
    public function __construct(
        private readonly string $expectedOpaqueToken,
        private readonly ResponseFactoryInterface $responses,
    ) {}

    public function process(ServerRequestInterface $request, RequestHandlerInterface $handler): ResponseInterface
    {
        $header = trim($request->getHeaderLine('Authorization'));
        if ($header === '' || ! preg_match('/^Bearer\\s+(\\S+)/i', $header, $m)) {
            return JsonResponder::error(
                $this->responses->createResponse(),
                'unauthorized',
                'Bearer token missing',
                StatusCodeInterface::STATUS_UNAUTHORIZED,
            )->withHeader('WWW-Authenticate', 'Bearer realm="tutor"');
        }

        /** @var non-empty-string $given */
        $given = $m[1];

        if (strlen($given) !== strlen($this->expectedOpaqueToken)) {
            return JsonResponder::error(
                $this->responses->createResponse(),
                'unauthorized',
                'Invalid bearer token',
                StatusCodeInterface::STATUS_UNAUTHORIZED,
            )->withHeader('WWW-Authenticate', 'Bearer realm="tutor"');
        }

        if (! hash_equals($this->expectedOpaqueToken, $given)) {
            return JsonResponder::error(
                $this->responses->createResponse(),
                'unauthorized',
                'Invalid bearer token',
                StatusCodeInterface::STATUS_UNAUTHORIZED,
            )->withHeader('WWW-Authenticate', 'Bearer realm="tutor"');
        }

        return $handler->handle($request);
    }
}

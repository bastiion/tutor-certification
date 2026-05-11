<?php

declare(strict_types=1);

use App\Middleware\CorsMiddleware;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

describe('CorsMiddleware', function (): void {
    test('OPTIONS returns 204 with reflected origin and requested headers', function (): void {
        $mw = new CorsMiddleware(['https://allowed.example']);
        $req = (new ServerRequestFactory())->createServerRequest('OPTIONS', 'http://localhost/api/x')
            ->withHeader('Origin', 'https://allowed.example')
            ->withHeader('Access-Control-Request-Headers', 'X-Custom-Header');

        $handler = new class implements RequestHandlerInterface {
            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                throw new \RuntimeException('handler must not run for OPTIONS');
            }
        };

        $res = $mw->process($req, $handler);

        expect($res->getStatusCode())->toBe(204)
            ->and($res->getHeaderLine('Access-Control-Allow-Origin'))->toBe('https://allowed.example')
            ->and($res->getHeaderLine('Access-Control-Allow-Methods'))->toBe('GET, POST, OPTIONS')
            ->and($res->getHeaderLine('Access-Control-Allow-Headers'))->toBe('X-Custom-Header')
            ->and($res->getHeaderLine('Access-Control-Max-Age'))->toBe('86400')
            ->and($res->getHeaderLine('Vary'))->toBe('Origin');
    });

    test('OPTIONS uses default Allow-Headers when browser sends none', function (): void {
        $mw = new CorsMiddleware(['https://allowed.example']);
        $req = (new ServerRequestFactory())->createServerRequest('OPTIONS', 'http://localhost/api/x')
            ->withHeader('Origin', 'https://allowed.example');

        $handler = new class implements RequestHandlerInterface {
            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                throw new \RuntimeException('handler must not run for OPTIONS');
            }
        };

        $res = $mw->process($req, $handler);

        expect($res->getHeaderLine('Access-Control-Allow-Headers'))
            ->toBe('Authorization, Content-Type, Accept');
    });

    test('GET delegates to handler and appends CORS headers for allowed Origin', function (): void {
        $mw = new CorsMiddleware(['https://allowed.example']);
        $req = (new ServerRequestFactory())->createServerRequest('GET', 'http://localhost/api/x')
            ->withHeader('Origin', 'https://allowed.example');

        $inner = (new ResponseFactory())->createResponse(200);
        $handler = new class ($inner) implements RequestHandlerInterface {
            public function __construct(private ResponseInterface $inner) {}

            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                return $this->inner;
            }
        };

        $res = $mw->process($req, $handler);

        expect($res->getStatusCode())->toBe(200)
            ->and($res->getHeaderLine('Access-Control-Allow-Origin'))->toBe('https://allowed.example');
    });

    test('unknown Origin does not add CORS headers', function (): void {
        $mw = new CorsMiddleware(['https://allowed.example']);
        $req = (new ServerRequestFactory())->createServerRequest('GET', 'http://localhost/api/x')
            ->withHeader('Origin', 'https://evil.example');

        $inner = (new ResponseFactory())->createResponse(200);
        $handler = new class ($inner) implements RequestHandlerInterface {
            public function __construct(private ResponseInterface $inner) {}

            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                return $this->inner;
            }
        };

        $res = $mw->process($req, $handler);

        expect($res->getHeaderLine('Access-Control-Allow-Origin'))->toBe('')
            ->and($res->hasHeader('Access-Control-Allow-Methods'))->toBeFalse();
    });

    test('lowercase options method is treated as preflight', function (): void {
        $mw = new CorsMiddleware(['https://allowed.example']);
        $req = (new ServerRequestFactory())->createServerRequest('options', 'http://localhost/api/x')
            ->withHeader('Origin', 'https://allowed.example');

        $handler = new class implements RequestHandlerInterface {
            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                throw new \RuntimeException('handler must not run for OPTIONS');
            }
        };

        $res = $mw->process($req, $handler);

        expect($res->getStatusCode())->toBe(204);
    });
});

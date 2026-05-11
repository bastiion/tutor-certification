<?php

declare(strict_types=1);

use App\Middleware\BearerTokenMiddleware;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

describe('BearerTokenMiddleware', function (): void {
    test('401 without Authorization header', function (): void {
        $fact = new ResponseFactory();
        $mw = new BearerTokenMiddleware('tok', $fact);
        $handler = new class implements RequestHandlerInterface {
            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                return (new ResponseFactory())->createResponse(200);
            }
        };

        $req = (new ServerRequestFactory())->createServerRequest('GET', '/');
        $res = $mw->process($req, $handler);
        expect($res->getStatusCode())->toBe(401);
    });

    test('allows matching bearer token', function (): void {
        $fact = new ResponseFactory();
        $mw = new BearerTokenMiddleware('correct-token', $fact);
        $handler = new class implements RequestHandlerInterface {
            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                return (new ResponseFactory())->createResponse(204);
            }
        };

        $req = (new ServerRequestFactory())->createServerRequest('GET', '/')
            ->withHeader('Authorization', 'Bearer correct-token');

        $res = $mw->process($req, $handler);
        expect($res->getStatusCode())->toBe(204);
    });

    test('401 when bearer keyword malformed', function (): void {
        $fact = new ResponseFactory();
        $mw = new BearerTokenMiddleware('tok', $fact);
        $handler = new class implements RequestHandlerInterface {
            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                return (new ResponseFactory())->createResponse(200);
            }
        };

        $req = (new ServerRequestFactory())->createServerRequest('GET', '/')
            ->withHeader('Authorization', 'Bear tok');

        $res = $mw->process($req, $handler);
        expect($res->getStatusCode())->toBe(401);
    });

    test('401 when token length differs from expected', function (): void {
        $fact = new ResponseFactory();
        $mw = new BearerTokenMiddleware('abcd', $fact);
        $handler = new class implements RequestHandlerInterface {
            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                return (new ResponseFactory())->createResponse(200);
            }
        };

        $req = (new ServerRequestFactory())->createServerRequest('GET', '/')
            ->withHeader('Authorization', 'Bearer abc');

        $res = $mw->process($req, $handler);
        expect($res->getStatusCode())->toBe(401);
    });

    test('401 when token length matches but value differs', function (): void {
        $fact = new ResponseFactory();
        $expected = str_repeat('a', 32);
        $given = str_repeat('b', 32);
        $mw = new BearerTokenMiddleware($expected, $fact);
        $handler = new class implements RequestHandlerInterface {
            public function handle(ServerRequestInterface $request): ResponseInterface
            {
                return (new ResponseFactory())->createResponse(200);
            }
        };

        $req = (new ServerRequestFactory())->createServerRequest('GET', '/')
            ->withHeader('Authorization', 'Bearer ' . $given);

        $res = $mw->process($req, $handler);
        expect($res->getStatusCode())->toBe(401);
    });
});

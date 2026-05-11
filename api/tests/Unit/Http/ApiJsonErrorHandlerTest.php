<?php

declare(strict_types=1);

use App\Http\ApiJsonErrorHandler;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpForbiddenException;
use Slim\Exception\HttpNotFoundException;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

describe('ApiJsonErrorHandler', function (): void {
    test('maps HTTP exception status and uses HttpSpecializedException description when message empty', function (): void {
        $factory = new ResponseFactory();
        $handler = new ApiJsonErrorHandler($factory);
        $req = (new ServerRequestFactory())->createServerRequest('GET', '/');

        $ex = new HttpNotFoundException($req, '');
        $res = $handler($req, $ex, false, false, false);

        expect($res->getStatusCode())->toBe(404);
        $body = json_decode((string) $res->getBody(), true, flags: JSON_THROW_ON_ERROR);
        expect($body['error']['code'] ?? null)->toBe('not_found');
        expect($body['error']['message'] ?? '')->not->toBe('');
    });

    test('maps forbidden to forbidden code', function (): void {
        $factory = new ResponseFactory();
        $handler = new ApiJsonErrorHandler($factory);
        $req = (new ServerRequestFactory())->createServerRequest('POST', '/');

        $ex = new HttpForbiddenException($req, 'nope');
        $res = $handler($req, $ex, false, false, false);

        expect($res->getStatusCode())->toBe(403);
        $body = json_decode((string) $res->getBody(), true, flags: JSON_THROW_ON_ERROR);
        expect($body['error']['code'] ?? null)->toBe('forbidden');
        expect($body['error']['message'] ?? null)->toBe('nope');
    });

    test('maps generic throwable to 500 internal_error', function (): void {
        $factory = new ResponseFactory();
        $handler = new ApiJsonErrorHandler($factory);
        $req = (new ServerRequestFactory())->createServerRequest('GET', '/');

        $res = $handler($req, new \RuntimeException('boom'), false, false, false);

        expect($res->getStatusCode())->toBe(500);
        $body = json_decode((string) $res->getBody(), true, flags: JSON_THROW_ON_ERROR);
        expect($body['error']['code'] ?? null)->toBe('internal_error');
        expect($body['error']['message'] ?? null)->toBe('boom');
    });

    test('fills empty generic exception message with safe default', function (): void {
        $factory = new ResponseFactory();
        $handler = new ApiJsonErrorHandler($factory);
        $req = (new ServerRequestFactory())->createServerRequest('GET', '/');

        $res = $handler($req, new \RuntimeException(''), false, false, false);

        expect($res->getStatusCode())->toBe(500);
        $body = json_decode((string) $res->getBody(), true, flags: JSON_THROW_ON_ERROR);
        expect($body['error']['message'] ?? null)->toBe('Internal Server Error');
    });

    test('bad request keeps explicit message', function (): void {
        $factory = new ResponseFactory();
        $handler = new ApiJsonErrorHandler($factory);
        $req = (new ServerRequestFactory())->createServerRequest('POST', '/');

        $ex = new HttpBadRequestException($req, 'fix your JSON');
        $res = $handler($req, $ex, false, false, false);

        expect($res->getStatusCode())->toBe(400);
        $body = json_decode((string) $res->getBody(), true, flags: JSON_THROW_ON_ERROR);
        expect($body['error']['code'] ?? null)->toBe('bad_request');
        expect($body['error']['message'] ?? null)->toBe('fix your JSON');
    });
});

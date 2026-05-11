<?php

declare(strict_types=1);

use App\Action\OpenApiAction;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

describe('OpenApiAction', function (): void {
    test('503 when spec file is missing', function (): void {
        $req = (new ServerRequestFactory())->createServerRequest('GET', '/api/openapi.json');
        $res = (new ResponseFactory())->createResponse();
        $path = sys_get_temp_dir() . '/openapi-spec-missing-' . bin2hex(random_bytes(6)) . '.json';

        $action = new OpenApiAction($path);
        $out = $action($req, $res, []);

        expect($out->getStatusCode())->toBe(503);
        $body = json_decode((string) $out->getBody(), true, flags: JSON_THROW_ON_ERROR);
        expect($body['error']['code'] ?? null)->toBe('spec_missing');
    });

    test('503 when spec file is empty', function (): void {
        $tmp = tempnam(sys_get_temp_dir(), 'openapi-spec-empty');
        expect($tmp)->not->toBeFalse();
        file_put_contents($tmp, '');

        try {
            $req = (new ServerRequestFactory())->createServerRequest('GET', '/api/openapi.json');
            $res = (new ResponseFactory())->createResponse();
            $action = new OpenApiAction($tmp);
            $out = $action($req, $res, []);

            expect($out->getStatusCode())->toBe(503);
            $body = json_decode((string) $out->getBody(), true, flags: JSON_THROW_ON_ERROR);
            expect($body['error']['code'] ?? null)->toBe('spec_unreadable');
        } finally {
            unlink($tmp);
        }
    });

    test('200 serves raw JSON and sets Cache-Control', function (): void {
        $tmp = tempnam(sys_get_temp_dir(), 'openapi-spec-ok');
        expect($tmp)->not->toBeFalse();
        $payload = '{"openapi":"3.0.0","info":{"title":"t"}}';
        file_put_contents($tmp, $payload);

        try {
            $req = (new ServerRequestFactory())->createServerRequest('GET', '/api/openapi.json');
            $res = (new ResponseFactory())->createResponse();
            $action = new OpenApiAction($tmp);
            $out = $action($req, $res, []);

            expect($out->getStatusCode())->toBe(200);
            expect((string) $out->getBody())->toBe($payload);
            expect($out->getHeaderLine('Cache-Control'))->toBe('no-store');
        } finally {
            unlink($tmp);
        }
    });
});

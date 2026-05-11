<?php

declare(strict_types=1);

use App\Action\ServerPublicKeyAction;
use App\Crypto\Signer;
use App\Env;
use Slim\Psr7\Factory\ResponseFactory;
use Slim\Psr7\Factory\ServerRequestFactory;

describe('ServerPublicKeyAction', function (): void {
    test('returns 200 with URL-safe Base64-encoded 32-byte public key slice', function (): void {
        $signer = new Signer();
        $req = (new ServerRequestFactory())->createServerRequest('GET', '/api/server-public-key');
        $res = (new ResponseFactory())->createResponse();
        $action = new ServerPublicKeyAction($signer);
        $out = $action($req, $res, []);

        expect($out->getStatusCode())->toBe(200);
        expect($out->getHeaderLine('Content-Type'))->toContain('application/json');

        /** @var array{x25519_pk: string} $body */
        $body = json_decode((string) $out->getBody(), true, flags: JSON_THROW_ON_ERROR);
        $decoded = $signer->base64UrlDecode($body['x25519_pk']);
        expect(strlen($decoded))->toBe(SODIUM_CRYPTO_BOX_PUBLICKEYBYTES);

        $full = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
        expect(substr($full, SODIUM_CRYPTO_BOX_SECRETKEYBYTES, SODIUM_CRYPTO_BOX_PUBLICKEYBYTES))->toBe($decoded);
    });

    test('503 when SERVER_BOX_KEYPAIR_BASE64 is missing', function (): void {
        $prev = getenv('SERVER_BOX_KEYPAIR_BASE64');
        putenv('SERVER_BOX_KEYPAIR_BASE64');
        unset($_ENV['SERVER_BOX_KEYPAIR_BASE64']);

        try {
            $signer = new Signer();
            $req = (new ServerRequestFactory())->createServerRequest('GET', '/api/server-public-key');
            $res = (new ResponseFactory())->createResponse();
            $action = new ServerPublicKeyAction($signer);
            $out = $action($req, $res, []);

            expect($out->getStatusCode())->toBe(503);
            /** @var array{error: array{code: string}} $body */
            $body = json_decode((string) $out->getBody(), true, flags: JSON_THROW_ON_ERROR);
            expect($body['error']['code'] ?? null)->toBe('server-key-unavailable');
        } finally {
            if ($prev !== false) {
                putenv('SERVER_BOX_KEYPAIR_BASE64=' . $prev);
                $_ENV['SERVER_BOX_KEYPAIR_BASE64'] = $prev;
            } else {
                putenv('SERVER_BOX_KEYPAIR_BASE64');
            }
        }
    });

    test('503 when SERVER_BOX_KEYPAIR_BASE64 is not valid Base64URL', function (): void {
        $prev = getenv('SERVER_BOX_KEYPAIR_BASE64');
        putenv('SERVER_BOX_KEYPAIR_BASE64=%%%');
        $_ENV['SERVER_BOX_KEYPAIR_BASE64'] = '%%%';

        try {
            $signer = new Signer();
            $req = (new ServerRequestFactory())->createServerRequest('GET', '/api/server-public-key');
            $res = (new ResponseFactory())->createResponse();
            $action = new ServerPublicKeyAction($signer);
            $out = $action($req, $res, []);

            expect($out->getStatusCode())->toBe(503);
        } finally {
            if ($prev !== false) {
                putenv('SERVER_BOX_KEYPAIR_BASE64=' . $prev);
                $_ENV['SERVER_BOX_KEYPAIR_BASE64'] = $prev;
            } else {
                putenv('SERVER_BOX_KEYPAIR_BASE64');
                unset($_ENV['SERVER_BOX_KEYPAIR_BASE64']);
            }
        }
    });

    test('503 when decoded keypair length is wrong', function (): void {
        $prev = getenv('SERVER_BOX_KEYPAIR_BASE64');
        $signer = new Signer();
        $bad = $signer->base64UrlEncode(random_bytes(16));
        putenv('SERVER_BOX_KEYPAIR_BASE64=' . $bad);
        $_ENV['SERVER_BOX_KEYPAIR_BASE64'] = $bad;

        try {
            $req = (new ServerRequestFactory())->createServerRequest('GET', '/api/server-public-key');
            $res = (new ResponseFactory())->createResponse();
            $action = new ServerPublicKeyAction($signer);
            $out = $action($req, $res, []);

            expect($out->getStatusCode())->toBe(503);
        } finally {
            if ($prev !== false) {
                putenv('SERVER_BOX_KEYPAIR_BASE64=' . $prev);
                $_ENV['SERVER_BOX_KEYPAIR_BASE64'] = $prev;
            } else {
                putenv('SERVER_BOX_KEYPAIR_BASE64');
                unset($_ENV['SERVER_BOX_KEYPAIR_BASE64']);
            }
        }
    });
});

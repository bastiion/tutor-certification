<?php

declare(strict_types=1);

use App\Http\JsonResponder;
use Slim\Psr7\Factory\ResponseFactory;

describe('JsonResponder', function (): void {
    test('json throws when payload cannot be encoded', function (): void {
        $response = (new ResponseFactory())->createResponse();

        expect(fn () => JsonResponder::json($response, ['x' => NAN]))
            ->toThrow(\RuntimeException::class, 'JSON encode failure');
    });

    test('error envelope encodes successfully', function (): void {
        $response = (new ResponseFactory())->createResponse();
        $out = JsonResponder::error($response, 'test_code', 'hello', 418);

        expect($out->getStatusCode())->toBe(418);
        $body = json_decode((string) $out->getBody(), true, flags: JSON_THROW_ON_ERROR);
        expect($body)->toBe(['error' => ['code' => 'test_code', 'message' => 'hello']]);
    });
});

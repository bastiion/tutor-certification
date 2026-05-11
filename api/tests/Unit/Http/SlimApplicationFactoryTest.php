<?php

declare(strict_types=1);

use App\Crypto\Signer;
use App\Env;
use App\Http\SlimApplicationFactory;
use Tests\Support\AppRequest;
use Tests\Support\SessionCredentialFixture;

describe('SlimApplicationFactory', function (): void {
    test('throws when SERVER_BOX_KEYPAIR_BASE64 decodes to wrong length', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-slim-badbox-');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        $origBox = $_ENV['SERVER_BOX_KEYPAIR_BASE64'] ?? getenv('SERVER_BOX_KEYPAIR_BASE64');
        assert(is_string($origBox) && $origBox !== '');

        $tooShort = sodium_bin2base64(random_bytes(16), SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING);
        putenv('SERVER_BOX_KEYPAIR_BASE64=' . $tooShort);
        $_ENV['SERVER_BOX_KEYPAIR_BASE64'] = $tooShort;

        try {
            expect(fn (): \Slim\App => SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 3)))
                ->toThrow(\RuntimeException::class, 'SERVER_BOX_KEYPAIR_BASE64');
        } finally {
            @unlink($sqlite);
            putenv('SERVER_BOX_KEYPAIR_BASE64=' . $origBox);
            $_ENV['SERVER_BOX_KEYPAIR_BASE64'] = $origBox;
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('uses default public base URL when PUBLIC_BASE_URL is unset', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-slim-puburl-');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        $origPub = $_ENV['PUBLIC_BASE_URL'] ?? getenv('PUBLIC_BASE_URL');
        assert(is_string($origPub) && $origPub !== '');

        putenv('PUBLIC_BASE_URL');
        unset($_ENV['PUBLIC_BASE_URL']);

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 3));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $cred = SessionCredentialFixture::validArray($signer, $box, 'bb8f5b2e-4b2a-7000-9000-abcdef123456', time() + 7200);
            $res = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . Env::string('TUTOR_API_TOKEN')],
            ], $cred);
            expect($res->getStatusCode())->toBe(200);
            $body = json_decode((string) $res->getBody(), true, flags: JSON_THROW_ON_ERROR);
            assert(is_array($body));
            assert(isset($body['enroll_url']) && is_string($body['enroll_url']));
            expect(str_starts_with($body['enroll_url'], 'http://localhost:7123/enroll/'))->toBeTrue();
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
            putenv('PUBLIC_BASE_URL=' . $origPub);
            $_ENV['PUBLIC_BASE_URL'] = $origPub;
        }
    });
});

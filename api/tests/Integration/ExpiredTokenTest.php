<?php

declare(strict_types=1);

use App\Crypto\Signer;
use App\Env;
use App\Http\SlimApplicationFactory;
use Tests\Support\AppRequest;
use Tests\Support\SessionCredentialFixture;

describe('Enrollment expiry', function (): void {
    test('returns 410 when token window has closed', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'ikwsd-expired-');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        $apiRoot = dirname(__DIR__, 2);
        $app = SlimApplicationFactory::fromApiRoot($apiRoot);

        $signer = new Signer();
        $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');

        $courseId = '078f5b2e-4b2a-7000-9000-abcdef123456';
        $past = time() - 120;

        $payload = SessionCredentialFixture::validArray($signer, $box, $courseId, $past);

        $token = getenv('TUTOR_API_TOKEN');
        expect($token)->not->toBeFalse();

        $sessionRes = AppRequest::dispatch($app, 'POST', '/api/sessions', [
            'Authorization' => ['Bearer ' . $token],
        ], $payload);

        expect($sessionRes->getStatusCode())->toBe(200);

        $sessionJson = json_decode((string) $sessionRes->getBody(), true, flags: JSON_THROW_ON_ERROR);
        $enrollUrl = $sessionJson['enroll_url'];
        expect($enrollUrl)->toBeString();

        $path = (string) parse_url((string) $enrollUrl, PHP_URL_PATH);
        expect($path)->not->toBeFalse();
        $apiEnrollPath = preg_replace('#^/enroll/#', '/api/enroll/', $path, 1);

        $enrollRes = AppRequest::dispatch($app, 'POST', $apiEnrollPath, [], ['name' => 'Ada']);

        expect($enrollRes->getStatusCode())->toBe(410);
    });
});

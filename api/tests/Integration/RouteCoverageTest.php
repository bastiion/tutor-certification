<?php

declare(strict_types=1);

use App\Crypto\Signer;
use App\Env;
use App\Http\SlimApplicationFactory;
use Tests\Support\AppRequest;
use Tests\Support\SessionCredentialFixture;

describe('HTTP route coverage', function (): void {
    test('GET /api/health returns ok and GIT_SHA when set', function (): void {
        putenv('GIT_SHA=deadbeef');
        $_ENV['GIT_SHA'] = 'deadbeef';

        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-h');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatch($app, 'GET', '/api/health');
            expect($res->getStatusCode())->toBe(200);
            $json = json_decode((string) $res->getBody(), true, flags: JSON_THROW_ON_ERROR);
            expect($json['ok'] ?? null)->toBeTrue();
            expect($json['build'] ?? null)->toBe('deadbeef');
        } finally {
            putenv('GIT_SHA');
            unset($_ENV['GIT_SHA']);
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('GET /api/health uses GIT_COMMIT_SHA when GIT_SHA is unset', function (): void {
        putenv('GIT_SHA');
        unset($_ENV['GIT_SHA']);
        putenv('GIT_COMMIT_SHA=abccommit');
        $_ENV['GIT_COMMIT_SHA'] = 'abccommit';

        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-h2');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatch($app, 'GET', '/api/health');
            $json = json_decode((string) $res->getBody(), true, flags: JSON_THROW_ON_ERROR);
            expect($json['build'] ?? null)->toBe('abccommit');
        } finally {
            putenv('GIT_COMMIT_SHA');
            unset($_ENV['GIT_COMMIT_SHA']);
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('GET /api/health reports unknown build when no git env is set', function (): void {
        putenv('GIT_SHA');
        unset($_ENV['GIT_SHA']);
        putenv('GIT_COMMIT_SHA');
        unset($_ENV['GIT_COMMIT_SHA']);

        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-h3');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatch($app, 'GET', '/api/health');
            $json = json_decode((string) $res->getBody(), true, flags: JSON_THROW_ON_ERROR);
            expect($json['build'] ?? null)->toBe('unknown');
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions returns 400 when credential misses required fields', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-sf');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . Env::string('TUTOR_API_TOKEN')],
            ], ['course_id' => '018f5b2e-4b2a-7000-9000-abcdef123456']);

            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions returns 400 when JSON body is not an object', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-json');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatchWithRawBody($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . Env::string('TUTOR_API_TOKEN')],
            ], 'null');

            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions returns 400 when session_sig is not valid Base64URL', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-ss');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $cred = SessionCredentialFixture::validArray($signer, $box, '188f5b2e-4b2a-7000-9000-abcdef123456', time() + 7200);
            $cred['session_sig'] = '@@@@';

            $res = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . Env::string('TUTOR_API_TOKEN')],
            ], $cred);

            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions returns 400 when K_master_public is not valid Base64URL', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-mp');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $cred = SessionCredentialFixture::validArray($signer, $box, '198f5b2e-4b2a-7000-9000-abcdef123456', time() + 7200);
            $cred['K_master_public'] = '@@@@';

            $res = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . Env::string('TUTOR_API_TOKEN')],
            ], $cred);

            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('POST /api/revocations returns 400 when JSON body is not an object', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-rj');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $cred = SessionCredentialFixture::validArray($signer, $box, '1a8f5b2e-4b2a-7000-9000-abcdef123456', time() + 3600);

            $bearer = Env::string('TUTOR_API_TOKEN');
            $sess = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $bearer],
            ], $cred);
            expect($sess->getStatusCode())->toBe(200);

            $res = AppRequest::dispatchWithRawBody($app, 'POST', '/api/revocations', [
                'Authorization' => ['Bearer ' . $bearer],
            ], 'null');

            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions rejects wrong-length bearer token', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-s');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $longToken = Env::string('TUTOR_API_TOKEN') . 'x';
            $res = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $longToken],
            ], ['course_id' => 'x']);

            expect($res->getStatusCode())->toBe(401);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions rejects bearer value that does not match', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-s2');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $tok = Env::string('TUTOR_API_TOKEN');
            $wrong = strlen($tok) >= 1
                ? substr($tok, 0, -1) . ($tok[strlen($tok) - 1] === '0' ? '1' : '0')
                : 'x';

            $res = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $wrong],
            ], ['course_id' => 'x']);

            expect($res->getStatusCode())->toBe(401);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('POST /api/enroll with opaque garbage yields 404', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-e');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatch($app, 'POST', '/api/enroll/not-a-valid-token-at-all', [], ['name' => 'X']);
            expect($res->getStatusCode())->toBe(404);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('GET /api/verify rejects whitespace-only cert id', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-v');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatch($app, 'GET', '/api/verify/' . rawurlencode("\t \t"));
            expect($res->getStatusCode())->toBe(404);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('POST /api/revocations with empty sessions returns 404', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-r');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $bearer = Env::string('TUTOR_API_TOKEN');
            $res = AppRequest::dispatch($app, 'POST', '/api/revocations', [
                'Authorization' => ['Bearer ' . $bearer],
            ], [
                'cert_id' => '018f5b2e-4b2a-7000-9000-abcdef123456',
                'revoked_at' => gmdate('c'),
                'reason' => 'none',
                'signature' => 'aa',
            ]);

            expect($res->getStatusCode())->toBe(404);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('POST /api/revocations rejects signature not matching any tutor key', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-r2');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $cred = SessionCredentialFixture::validArray($signer, $box, '118f5b2e-4b2a-7000-9000-abcdef123456', time() + 3600);

            $bearer = Env::string('TUTOR_API_TOKEN');
            $sess = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $bearer],
            ], $cred);
            expect($sess->getStatusCode())->toBe(200);

            $foreignSig = $signer->base64UrlEncode(random_bytes(SODIUM_CRYPTO_SIGN_BYTES));
            $res = AppRequest::dispatch($app, 'POST', '/api/revocations', [
                'Authorization' => ['Bearer ' . $bearer],
            ], [
                'cert_id' => '018f5b2e-4b2a-7000-9000-abcdef123456',
                'revoked_at' => gmdate('c'),
                'reason' => 'forgery',
                'signature' => $foreignSig,
            ]);

            expect($res->getStatusCode())->toBe(403);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions returns 409 when course already exists', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-dup');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $courseId = '128f5b2e-4b2a-7000-9000-abcdef123456';
            $cred = SessionCredentialFixture::validArray($signer, $box, $courseId, time() + 7200);

            $bearer = Env::string('TUTOR_API_TOKEN');
            $first = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $bearer],
            ], $cred);
            expect($first->getStatusCode())->toBe(200);

            $second = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $bearer],
            ], $cred);
            expect($second->getStatusCode())->toBe(409);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions returns 400 when session_sig does not verify', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-sig');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $cred = SessionCredentialFixture::validArray($signer, $box, '158f5b2e-4b2a-7000-9000-abcdef123456', time() + 7200);
            $cred['session_sig'] = $signer->base64UrlEncode(random_bytes(SODIUM_CRYPTO_SIGN_BYTES));

            $bearer = Env::string('TUTOR_API_TOKEN');
            $res = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $bearer],
            ], $cred);

            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions returns 400 when fingerprint mismatches master key', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-fp');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $cred = SessionCredentialFixture::validArray($signer, $box, '138f5b2e-4b2a-7000-9000-abcdef123456', time() + 7200);
            $cred['K_master_public_fingerprint'] = str_repeat('a', 64);

            $bearer = Env::string('TUTOR_API_TOKEN');
            $res = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $bearer],
            ], $cred);

            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('POST /api/revocations returns 400 when signature is not valid Base64URL', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-r4');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $cred = SessionCredentialFixture::validArray($signer, $box, '168f5b2e-4b2a-7000-9000-abcdef123456', time() + 3600);

            $bearer = Env::string('TUTOR_API_TOKEN');
            $sess = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $bearer],
            ], $cred);
            expect($sess->getStatusCode())->toBe(200);

            $res = AppRequest::dispatch($app, 'POST', '/api/revocations', [
                'Authorization' => ['Bearer ' . $bearer],
            ], [
                'cert_id' => '018f5b2e-4b2a-7000-9000-abcdef123456',
                'revoked_at' => gmdate('c'),
                'reason' => 'bad sig encoding',
                'signature' => '%%%invalid%%%',
            ]);

            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('POST /api/revocations returns 400 when document is malformed', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-r5');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $cred = SessionCredentialFixture::validArray($signer, $box, '178f5b2e-4b2a-7000-9000-abcdef123456', time() + 3600);

            $bearer = Env::string('TUTOR_API_TOKEN');
            $sess = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $bearer],
            ], $cred);
            expect($sess->getStatusCode())->toBe(200);

            $res = AppRequest::dispatch($app, 'POST', '/api/revocations', [
                'Authorization' => ['Bearer ' . $bearer],
            ], [
                'cert_id' => '018f5b2e-4b2a-7000-9000-abcdef123456',
            ]);

            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });

    test('POST /api/enroll returns 400 when name is missing', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-n');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $courseId = '148f5b2e-4b2a-7000-9000-abcdef123456';
            $cred = SessionCredentialFixture::validArray($signer, $box, $courseId, time() + 7200);

            $bearer = Env::string('TUTOR_API_TOKEN');
            $sess = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $bearer],
            ], $cred);
            $sessBody = json_decode((string) $sess->getBody(), true, flags: JSON_THROW_ON_ERROR);
            $path = parse_url((string) $sessBody['enroll_url'], PHP_URL_PATH);
            $apiEnrollPath = preg_replace('#^/enroll/#', '/api/enroll/', (string) $path, 1);

            $res = AppRequest::dispatch($app, 'POST', $apiEnrollPath, [], []);
            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('IKWSD_SQLITE_PATH');
            unset($_ENV['IKWSD_SQLITE_PATH']);
        }
    });
});

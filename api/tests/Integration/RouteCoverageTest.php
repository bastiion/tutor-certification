<?php

declare(strict_types=1);

use App\Crypto\Signer;
use App\Env;
use App\Http\SlimApplicationFactory;
use Tests\Support\AppRequest;
use Tests\Support\SessionCredentialFixture;

/**
 * @phpstan-assert array<mixed> $sessionBody
 */
function routeCoverageApiEnrollPath(mixed $sessionBody): string
{
    assert(is_array($sessionBody));
    assert(isset($sessionBody['enroll_url']) && is_string($sessionBody['enroll_url']));
    $enrollUrl = $sessionBody['enroll_url'];

    $path = parse_url($enrollUrl, PHP_URL_PATH);
    assert(is_string($path));

    $api = preg_replace('#^/enroll/#', '/api/enroll/', $path, 1);
    assert(is_string($api));

    return $api;
}

describe('HTTP route coverage', function (): void {
    test('GET /api/health prefers APP_VERSION when set', function (): void {
        putenv('APP_VERSION=staging-label');
        $_ENV['APP_VERSION'] = 'staging-label';
        putenv('GIT_SHA=ignored');
        $_ENV['GIT_SHA'] = 'ignored';

        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-h');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatch($app, 'GET', '/api/health');
            expect($res->getStatusCode())->toBe(200);
            $json = json_decode((string) $res->getBody(), true, flags: JSON_THROW_ON_ERROR);
            assert(is_array($json));
            expect($json['ok'] ?? null)->toBeTrue();
            expect($json['app_version'] ?? null)->toBe('staging-label');
            expect($json['schema_versions'] ?? null)->toBe(['certificate' => 1, 'revocation' => 1]);
        } finally {
            putenv('APP_VERSION');
            unset($_ENV['APP_VERSION']);
            putenv('GIT_SHA');
            unset($_ENV['GIT_SHA']);
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('GET /api/health falls back to GIT_SHA when APP_VERSION unset', function (): void {
        putenv('APP_VERSION');
        unset($_ENV['APP_VERSION']);
        putenv('GIT_SHA=deadbeef');
        $_ENV['GIT_SHA'] = 'deadbeef';

        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-h-git');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatch($app, 'GET', '/api/health');
            expect($res->getStatusCode())->toBe(200);
            $json = json_decode((string) $res->getBody(), true, flags: JSON_THROW_ON_ERROR);
            assert(is_array($json));
            expect($json['app_version'] ?? null)->toBe('deadbeef');
        } finally {
            putenv('GIT_SHA');
            unset($_ENV['GIT_SHA']);
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('GET /api/health uses GIT_COMMIT_SHA when APP_VERSION and GIT_SHA unset', function (): void {
        putenv('APP_VERSION');
        unset($_ENV['APP_VERSION']);
        putenv('GIT_SHA');
        unset($_ENV['GIT_SHA']);
        putenv('GIT_COMMIT_SHA=abccommit');
        $_ENV['GIT_COMMIT_SHA'] = 'abccommit';

        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-h2');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatch($app, 'GET', '/api/health');
            $json = json_decode((string) $res->getBody(), true, flags: JSON_THROW_ON_ERROR);
            assert(is_array($json));
            expect($json['app_version'] ?? null)->toBe('abccommit');
        } finally {
            putenv('GIT_COMMIT_SHA');
            unset($_ENV['GIT_COMMIT_SHA']);
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('GET /api/health reports unknown when no version env vars', function (): void {
        putenv('APP_VERSION');
        unset($_ENV['APP_VERSION']);
        putenv('GIT_SHA');
        unset($_ENV['GIT_SHA']);
        putenv('GIT_COMMIT_SHA');
        unset($_ENV['GIT_COMMIT_SHA']);

        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-h3');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatch($app, 'GET', '/api/health');
            $json = json_decode((string) $res->getBody(), true, flags: JSON_THROW_ON_ERROR);
            assert(is_array($json));
            expect($json['app_version'] ?? null)->toBe('unknown');
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('GET /api/server-public-key returns libsodium-compatible x25519_pk', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-spk');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatch($app, 'GET', '/api/server-public-key');
            expect($res->getStatusCode())->toBe(200);
            expect($res->getHeaderLine('Content-Type'))->toContain('application/json');

            $signer = new Signer();
            /** @var array{x25519_pk: string} $json */
            $json = json_decode((string) $res->getBody(), true, flags: JSON_THROW_ON_ERROR);

            $pk = $signer->base64UrlDecode($json['x25519_pk']);
            expect(strlen($pk))->toBe(SODIUM_CRYPTO_BOX_PUBLICKEYBYTES);

            $full = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            expect(substr($full, SODIUM_CRYPTO_BOX_SECRETKEYBYTES, SODIUM_CRYPTO_BOX_PUBLICKEYBYTES))->toBe($pk);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions returns 400 when credential misses required fields', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-sf');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . Env::string('TUTOR_API_TOKEN')],
            ], ['course_id' => '018f5b2e-4b2a-7000-9000-abcdef123456']);

            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions returns 400 when JSON body is not an object', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-json');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatchWithRawBody($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . Env::string('TUTOR_API_TOKEN')],
            ], 'null');

            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions returns 400 when session_sig is not valid Base64URL', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-ss');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

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
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions returns 400 when K_master_public is not valid Base64URL', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-mp');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

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
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/revocations returns 400 when JSON body is not an object', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-rj');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

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
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions rejects wrong-length bearer token', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-s');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $longToken = Env::string('TUTOR_API_TOKEN') . 'x';
            $res = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $longToken],
            ], ['course_id' => 'x']);

            expect($res->getStatusCode())->toBe(401);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions rejects bearer value that does not match', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-s2');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

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
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/enroll with opaque garbage yields 404', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-e');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatch($app, 'POST', '/api/enroll/not-a-valid-token-at-all', [], ['name' => 'X']);
            expect($res->getStatusCode())->toBe(404);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('GET /api/verify rejects whitespace-only cert id', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-v');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatch($app, 'GET', '/api/verify/' . rawurlencode("\t \t"));
            expect($res->getStatusCode())->toBe(404);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/revocations with empty sessions returns 404', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-r');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $bearer = Env::string('TUTOR_API_TOKEN');
            $res = AppRequest::dispatch($app, 'POST', '/api/revocations', [
                'Authorization' => ['Bearer ' . $bearer],
            ], [
                'cert_id' => '018f5b2e-4b2a-7000-9000-abcdef123456',
                'revoked_at' => gmdate('c'),
                'reason' => 'none',
                'schema_version' => 1,
                'signature' => 'aa',
            ]);

            expect($res->getStatusCode())->toBe(404);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/revocations rejects signature not matching any tutor key', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-r2');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

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
                'schema_version' => 1,
                'signature' => $foreignSig,
            ]);

            expect($res->getStatusCode())->toBe(403);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions returns 409 when course already exists', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-dup');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

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
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions returns 400 when session_sig does not verify', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-sig');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

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
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions returns 400 when fingerprint mismatches master key', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-fp');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

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
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/revocations returns 400 when signature is not valid Base64URL', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-r4');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

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
                'schema_version' => 1,
                'signature' => '%%%invalid%%%',
            ]);

            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/revocations returns 400 when document is malformed', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-r5');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

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
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/enroll returns 400 when name is missing', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-n');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

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
            $apiEnrollPath = routeCoverageApiEnrollPath($sessBody);

            $res = AppRequest::dispatch($app, 'POST', $apiEnrollPath, [], []);
            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/enroll embeds K_master_public and session_sig verifies from certificate JSON alone', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-verify-cert');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $courseId = 'a28f5b2e-4b2a-7000-9000-abcdef123456';
            $validUntilUnix = time() + 7200;

            $cred = SessionCredentialFixture::validArray($signer, $box, $courseId, $validUntilUnix);

            $bearer = Env::string('TUTOR_API_TOKEN');
            $sess = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $bearer],
            ], $cred);
            expect($sess->getStatusCode())->toBe(200);

            $sessBody = json_decode((string) $sess->getBody(), true, flags: JSON_THROW_ON_ERROR);
            $apiEnrollPath = routeCoverageApiEnrollPath($sessBody);

            $enroll = AppRequest::dispatch($app, 'POST', $apiEnrollPath, [], ['name' => 'Route Coverage']);
            expect($enroll->getStatusCode())->toBe(200);

            /** @var array<string, mixed> $cert */
            $cert = json_decode((string) $enroll->getBody(), true, flags: JSON_THROW_ON_ERROR);

            expect($cert['K_master_public'] ?? null)->toBe($cred['K_master_public']);
            expect(isset($cert['K_course_public'], $cert['session_sig']))->toBeTrue();
            expect($cert['valid_until'] ?? null)->toBe($validUntilUnix);

            $kMasterRaw = $signer->base64UrlDecode((string) $cert['K_master_public']);
            $kCourseRaw = $signer->base64UrlDecode((string) $cert['K_course_public']);
            $msg = $signer->sessionEndorsementMessage($courseId, $validUntilUnix, $kCourseRaw);
            $sig = $signer->base64UrlDecode((string) $cert['session_sig']);

            expect($signer->verifyDetached($msg, $sig, $kMasterRaw))->toBeTrue();
            /** @var array{name: non-empty-string, key_fingerprint: non-empty-string} $institute */
            $institute = $cert['institute'];
            expect($institute['key_fingerprint'])->toBe($signer->masterPublicFingerprintHex($kMasterRaw));
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('OPTIONS preflight receives CORS headers when origin is allowed', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-cors');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        $prev = getenv('CORS_ALLOWED_ORIGINS');
        putenv('CORS_ALLOWED_ORIGINS=http://localhost:5173');
        $_ENV['CORS_ALLOWED_ORIGINS'] = 'http://localhost:5173';

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $res = AppRequest::dispatch($app, 'OPTIONS', '/api/health', [
                'Origin' => ['http://localhost:5173'],
            ]);

            expect($res->getStatusCode())->toBe(204)
                ->and($res->getHeaderLine('Access-Control-Allow-Origin'))->toBe('http://localhost:5173');
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);

            if ($prev === false) {
                putenv('CORS_ALLOWED_ORIGINS');
                unset($_ENV['CORS_ALLOWED_ORIGINS']);
            } else {
                putenv('CORS_ALLOWED_ORIGINS=' . $prev);
                $_ENV['CORS_ALLOWED_ORIGINS'] = $prev;
            }
        }
    });

    test('POST /api/enroll returns 400 when JSON body is not an object', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-enroll-json');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $courseId = 'b38f5b2e-4b2a-7000-9000-abcdef123456';
            $cred = SessionCredentialFixture::validArray($signer, $box, $courseId, time() + 7200);

            $bearer = Env::string('TUTOR_API_TOKEN');
            $sess = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $bearer],
            ], $cred);
            expect($sess->getStatusCode())->toBe(200);

            $sessBody = json_decode((string) $sess->getBody(), true, flags: JSON_THROW_ON_ERROR);
            $apiEnrollPath = routeCoverageApiEnrollPath($sessBody);

            $res = AppRequest::dispatchWithRawBody($app, 'POST', $apiEnrollPath, [], 'null');
            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/enroll returns 400 when email has wrong type', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-enroll-mail');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $courseId = 'b48f5b2e-4b2a-7000-9000-abcdef123456';
            $cred = SessionCredentialFixture::validArray($signer, $box, $courseId, time() + 7200);

            $bearer = Env::string('TUTOR_API_TOKEN');
            $sess = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $bearer],
            ], $cred);
            expect($sess->getStatusCode())->toBe(200);

            $sessBody = json_decode((string) $sess->getBody(), true, flags: JSON_THROW_ON_ERROR);
            $apiEnrollPath = routeCoverageApiEnrollPath($sessBody);

            $res = AppRequest::dispatch($app, 'POST', $apiEnrollPath, [], ['name' => 'Ann', 'email' => 12345]);
            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/enroll returns 404 when stored master public is unreadable', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-enroll-mp');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $courseId = 'b58f5b2e-4b2a-7000-9000-abcdef123456';
            $cred = SessionCredentialFixture::validArray($signer, $box, $courseId, time() + 7200);

            $bearer = Env::string('TUTOR_API_TOKEN');
            $sess = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $bearer],
            ], $cred);
            expect($sess->getStatusCode())->toBe(200);

            $pdo = new PDO('sqlite:' . $sqlite, options: [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
            $stmt = $pdo->prepare('UPDATE sessions SET k_master_pub = ? WHERE id = ?');
            $stmt->execute(['@@@not-valid-b64url@@@', $courseId]);

            $sessBody = json_decode((string) $sess->getBody(), true, flags: JSON_THROW_ON_ERROR);
            $apiEnrollPath = routeCoverageApiEnrollPath($sessBody);

            $res = AppRequest::dispatch($app, 'POST', $apiEnrollPath, [], ['name' => 'Corrupt MP']);
            expect($res->getStatusCode())->toBe(404);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/enroll returns 400 when sealed course key ciphertext is invalid', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-enroll-enc');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $courseId = 'b68f5b2e-4b2a-7000-9000-abcdef123456';
            $cred = SessionCredentialFixture::validArray($signer, $box, $courseId, time() + 7200);

            $bearer = Env::string('TUTOR_API_TOKEN');
            $sess = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $bearer],
            ], $cred);
            expect($sess->getStatusCode())->toBe(200);

            $pdo = new PDO('sqlite:' . $sqlite, options: [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
            $stmt = $pdo->prepare('UPDATE sessions SET k_course_priv_enc = ? WHERE id = ?');
            $stmt->execute(['QQ', $courseId]);

            $sessBody = json_decode((string) $sess->getBody(), true, flags: JSON_THROW_ON_ERROR);
            $apiEnrollPath = routeCoverageApiEnrollPath($sessBody);

            $res = AppRequest::dispatch($app, 'POST', $apiEnrollPath, [], ['name' => 'Bad enc']);
            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/enroll returns 400 when decrypted course signing key length wrong', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-enroll-len');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $courseId = 'b78f5b2e-4b2a-7000-9000-abcdef123456';
            $cred = SessionCredentialFixture::validArray($signer, $box, $courseId, time() + 7200);

            $bearer = Env::string('TUTOR_API_TOKEN');
            $sess = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $bearer],
            ], $cred);
            expect($sess->getStatusCode())->toBe(200);

            $serverPk = sodium_crypto_box_publickey($box);
            $shortPlain = random_bytes(12);
            /** @var non-empty-string $badEnc */
            $badEnc = sodium_crypto_box_seal($shortPlain, $serverPk);

            $pdo = new PDO('sqlite:' . $sqlite, options: [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
            $stmt = $pdo->prepare('UPDATE sessions SET k_course_priv_enc = ? WHERE id = ?');
            $stmt->execute([$signer->base64UrlEncode($badEnc), $courseId]);

            $sessBody = json_decode((string) $sess->getBody(), true, flags: JSON_THROW_ON_ERROR);
            $apiEnrollPath = routeCoverageApiEnrollPath($sessBody);

            $res = AppRequest::dispatch($app, 'POST', $apiEnrollPath, [], ['name' => 'Short key']);
            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/enroll returns 400 when stored course public does not match decrypted secret', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-enroll-pkm');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $courseId = 'b88f5b2e-4b2a-7000-9000-abcdef123456';
            $cred = SessionCredentialFixture::validArray($signer, $box, $courseId, time() + 7200);

            $bearer = Env::string('TUTOR_API_TOKEN');
            $sess = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $bearer],
            ], $cred);
            expect($sess->getStatusCode())->toBe(200);

            $pdo = new PDO('sqlite:' . $sqlite, options: [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
            $foreignPk = sodium_crypto_sign_publickey(sodium_crypto_sign_keypair());
            $stmt = $pdo->prepare('UPDATE sessions SET k_course_pub = ? WHERE id = ?');
            $stmt->execute([$signer->base64UrlEncode($foreignPk), $courseId]);

            $sessBody = json_decode((string) $sess->getBody(), true, flags: JSON_THROW_ON_ERROR);
            $apiEnrollPath = routeCoverageApiEnrollPath($sessBody);

            $res = AppRequest::dispatch($app, 'POST', $apiEnrollPath, [], ['name' => 'Pk mismatch']);
            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/sessions returns 400 when credential JSON has unexpected fields', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-s-extra');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $cred = SessionCredentialFixture::validArray($signer, $box, 'b98f5b2e-4b2a-7000-9000-abcdef123456', time() + 7200);
            $cred['unexpected_field'] = true;

            $res = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . Env::string('TUTOR_API_TOKEN')],
            ], $cred);

            expect($res->getStatusCode())->toBe(400);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });

    test('POST /api/revocations skips unreadable master rows when verifying signature', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'api-route-rev-masters');
        putenv('API_SQLITE_PATH=' . $sqlite);
        $_ENV['API_SQLITE_PATH'] = $sqlite;

        try {
            $app = SlimApplicationFactory::fromApiRoot(dirname(__DIR__, 2));
            $signer = new Signer();
            $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
            $bundle = SessionCredentialFixture::validArrayWithSecrets($signer, $box, 'ba8f5b2e-4b2a-7000-9000-abcdef123456', time() + 7200);

            $tutorBearer = Env::string('TUTOR_API_TOKEN');
            $sess = AppRequest::dispatch($app, 'POST', '/api/sessions', [
                'Authorization' => ['Bearer ' . $tutorBearer],
            ], $bundle['credential']);
            expect($sess->getStatusCode())->toBe(200);

            $pdo = new PDO('sqlite:' . $sqlite, options: [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            ]);
            $junkPk = $signer->base64UrlEncode(random_bytes(32));
            $junkSig = $signer->base64UrlEncode(random_bytes(SODIUM_CRYPTO_SIGN_BYTES));
            $junkEnc = $signer->base64UrlEncode(random_bytes(48));
            $ins = $pdo->prepare(
                'INSERT INTO sessions (id, course_title, course_date, institute_name, k_master_pub, k_course_pub, session_sig, k_course_priv_enc, valid_until, tutor_email)
                 VALUES (:id, :t, :d, :i, :km, :kc, :ss, :ke, :vu, :em)',
            );
            $ins->execute([
                ':id' => 'junk-session-row',
                ':t' => 'junk',
                ':d' => '2026-01-01',
                ':i' => 'junk',
                ':km' => 'not-valid-base64url-master-pub',
                ':kc' => $junkPk,
                ':ss' => $junkSig,
                ':ke' => $junkEnc,
                ':vu' => time() + 3600,
                ':em' => 'junk@example.test',
            ]);

            $sessBody = json_decode((string) $sess->getBody(), true, flags: JSON_THROW_ON_ERROR);
            $apiEnrollPath = routeCoverageApiEnrollPath($sessBody);

            $enroll = AppRequest::dispatch($app, 'POST', $apiEnrollPath, [], ['name' => 'Rev Junk Masters']);
            expect($enroll->getStatusCode())->toBe(200);
            $cert = json_decode((string) $enroll->getBody(), true, flags: JSON_THROW_ON_ERROR);
            assert(is_array($cert));
            assert(isset($cert['cert_id']) && is_string($cert['cert_id']));
            $certId = $cert['cert_id'];

            $revokedAt = gmdate('c');
            $msg = (string) $certId . $revokedAt;
            $sig = sodium_crypto_sign_detached($msg, $bundle['master_secret_key_64']);
            $revPayload = [
                'cert_id' => $certId,
                'revoked_at' => $revokedAt,
                'reason' => 'junk-master-row-present',
                'schema_version' => 1,
                'signature' => $signer->base64UrlEncode($sig),
            ];

            $revRes = AppRequest::dispatch($app, 'POST', '/api/revocations', [
                'Authorization' => ['Bearer ' . $tutorBearer],
            ], $revPayload);

            expect($revRes->getStatusCode())->toBe(200);
        } finally {
            @unlink($sqlite);
            putenv('API_SQLITE_PATH');
            unset($_ENV['API_SQLITE_PATH']);
        }
    });
});

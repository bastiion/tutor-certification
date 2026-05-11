<?php

declare(strict_types=1);

use App\Crypto\Signer;
use App\Env;
use App\Http\SlimApplicationFactory;
use Tests\Support\AppRequest;
use Tests\Support\SessionCredentialFixture;

describe('Revocation integration', function (): void {
    test('revoked certificate surfaces on verify', function (): void {
        $sqlite = tempnam(sys_get_temp_dir(), 'ikwsd-revoke-');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        $apiRoot = dirname(__DIR__, 2);
        $app = SlimApplicationFactory::fromApiRoot($apiRoot);

        $signer = new Signer();
        $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
        $bundle = SessionCredentialFixture::validArrayWithSecrets($signer, $box, '098f5b2e-4b2a-7000-9000-abcdef123456', time() + 7200);

        $tutorBearer = Env::string('TUTOR_API_TOKEN');

        $sess = AppRequest::dispatch($app, 'POST', '/api/sessions', [
            'Authorization' => ['Bearer ' . $tutorBearer],
        ], $bundle['credential']);

        expect($sess->getStatusCode())->toBe(200);
        $sessBody = json_decode((string) $sess->getBody(), true, flags: JSON_THROW_ON_ERROR);
        $path = parse_url((string) $sessBody['enroll_url'], PHP_URL_PATH);
        $apiEnrollPath = preg_replace('#^/enroll/#', '/api/enroll/', (string) $path, 1);

        $enroll = AppRequest::dispatch($app, 'POST', $apiEnrollPath, [], ['name' => 'Revoke Me']);
        expect($enroll->getStatusCode())->toBe(200);
        $cert = json_decode((string) $enroll->getBody(), true, flags: JSON_THROW_ON_ERROR);
        $certId = $cert['cert_id'];
        expect($certId)->toBeString();

        $verifyOk = AppRequest::dispatch($app, 'GET', '/api/verify/' . rawurlencode((string) $certId));
        expect($verifyOk->getStatusCode())->toBe(200);
        $v1 = json_decode((string) $verifyOk->getBody(), true, flags: JSON_THROW_ON_ERROR);
        expect($v1['valid'] ?? null)->toBeTrue();

        $revokedAt = gmdate('c');
        $reason = 'integration-test';
        $msg = (string) $certId . $revokedAt;
        $sig = sodium_crypto_sign_detached($msg, $bundle['master_secret_key_64']);
        $revPayload = [
            'cert_id' => $certId,
            'revoked_at' => $revokedAt,
            'reason' => $reason,
            'signature' => (new Signer())->base64UrlEncode($sig),
        ];

        $revRes = AppRequest::dispatch($app, 'POST', '/api/revocations', [
            'Authorization' => ['Bearer ' . $tutorBearer],
        ], $revPayload);

        expect($revRes->getStatusCode())->toBe(200);

        $revDup = AppRequest::dispatch($app, 'POST', '/api/revocations', [
            'Authorization' => ['Bearer ' . $tutorBearer],
        ], $revPayload);

        expect($revDup->getStatusCode())->toBe(409);

        $verifyBad = AppRequest::dispatch($app, 'GET', '/api/verify/' . rawurlencode((string) $certId));
        expect($verifyBad->getStatusCode())->toBe(200);
        $v2 = json_decode((string) $verifyBad->getBody(), true, flags: JSON_THROW_ON_ERROR);
        expect($v2['valid'] ?? null)->toBeFalse();
        expect($v2['revocation_doc']['cert_id'] ?? null)->toBe($certId);
    });
});

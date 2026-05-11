<?php

declare(strict_types=1);

use App\Crypto\Signer;
use App\Env;
use App\Http\SlimApplicationFactory;
use Tests\Support\AppRequest;
use Tests\Support\MailpitHttpClient;
use Tests\Support\SessionCredentialFixture;

describe('Enroll mail integration', function (): void {
    test('session enroll issues certificate and tutor email arrives', function (): void {
        $apiBase = getenv('MAILPIT_API_BASE');
        expect($apiBase)->not->toBeFalse();
        $client = new MailpitHttpClient(is_string($apiBase) ? rtrim($apiBase, '/') : '');
        $client->deleteAllMessages();

        $sqlite = tempnam(sys_get_temp_dir(), 'ikwsd-enroll-');
        putenv('IKWSD_SQLITE_PATH=' . $sqlite);
        $_ENV['IKWSD_SQLITE_PATH'] = $sqlite;

        $apiRoot = dirname(__DIR__, 2);
        $app = SlimApplicationFactory::fromApiRoot($apiRoot);

        $signer = new Signer();
        $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
        $bundle = SessionCredentialFixture::validArrayWithSecrets($signer, $box, '088f5b2e-4b2a-7000-9000-abcdef123456', time() + 7200);

        $tutorBearer = Env::string('TUTOR_API_TOKEN');

        $sess = AppRequest::dispatch($app, 'POST', '/api/sessions', [
            'Authorization' => ['Bearer ' . $tutorBearer],
        ], $bundle['credential']);

        expect($sess->getStatusCode())->toBe(200);
        $sessBody = json_decode((string) $sess->getBody(), true, flags: JSON_THROW_ON_ERROR);
        $path = parse_url((string) $sessBody['enroll_url'], PHP_URL_PATH);
        expect($path)->toBeString();
        $apiEnrollPath = preg_replace('#^/enroll/#', '/api/enroll/', (string) $path, 1);

        $enroll = AppRequest::dispatch($app, 'POST', $apiEnrollPath, [], ['name' => 'Bob Tester']);
        expect($enroll->getStatusCode())->toBe(200);
        $cert = json_decode((string) $enroll->getBody(), true, flags: JSON_THROW_ON_ERROR);
        expect($cert['cert_id'] ?? null)->toBeString();

        $found = false;
        for ($i = 0; $i < 60; ++$i) {
            $list = $client->listMessagesPayload();
            $messages = $list['messages'] ?? [];
            if (is_array($messages) && $messages !== []) {
                $first = $messages[0];
                if (is_array($first) && isset($first['ID']) && is_string($first['ID'])) {
                    $detail = $client->fetchMessagePayload($first['ID']);
                    $sub = $detail['Subject'] ?? '';
                    if (is_string($sub) && str_contains($sub, 'Neue Teilnahmebescheinigung ausgestellt')) {
                        $found = true;

                        break;
                    }
                }
            }

            usleep(100_000);
        }

        expect($found)->toBeTrue();
    })->skip(
        fn (): bool => getenv('MAILPIT_INTEGRATION') !== '1',
        'Set MAILPIT_INTEGRATION=1 and run with Mailpit (docker compose).',
    );
});

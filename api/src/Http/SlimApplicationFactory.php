<?php

declare(strict_types=1);

namespace App\Http;

use App\Action\CreateRevocationAction;
use App\Action\CreateSessionAction;
use App\Action\EnrollAction;
use App\Action\HealthAction;
use App\Action\OpenApiAction;
use App\Action\ServerPublicKeyAction;
use App\Action\VerifyAction;
use App\Crypto\Signer;
use App\Crypto\Tokens;
use App\Db\Bootstrap as DbBootstrap;
use App\Env;
use App\Mail\CertificateMailer;
use App\Middleware\BearerTokenMiddleware;
use App\Middleware\CorsMiddleware;
use App\Middleware\JsonErrorMiddleware;
use App\Repository\RevocationRepository;
use App\Repository\SessionRepository;
use Slim\Factory\AppFactory;

final class SlimApplicationFactory
{
    /** @phpstan-return \Slim\App<\Psr\Http\Message\ResponseInterface> */
    public static function fromApiRoot(string $apiRootAbsolute): \Slim\App
    {
        $apiRootNormalized = rtrim($apiRootAbsolute, DIRECTORY_SEPARATOR);

        $pdo = (new DbBootstrap($apiRootNormalized))->createPdo();

        $signer = new Signer();
        $tokenKey = Env::base64UrlDecode('TOKEN_HMAC_KEY_BASE64');
        $tokens = new Tokens($tokenKey, $signer);

        $sessions = new SessionRepository($pdo, $signer);
        $revocations = new RevocationRepository($pdo);

        $smtpHost = Env::string('SMTP_HOST');
        $smtpPort = Env::int('SMTP_PORT');
        $fromAddrEnv = Env::stringOrNull('MAIL_FROM_ADDRESS');
        $fromAddr = is_string($fromAddrEnv) && $fromAddrEnv !== '' ? $fromAddrEnv : 'noreply@example.test';

        $smtpUserRaw = Env::stringOrNull('SMTP_USER');
        $smtpPassRaw = Env::stringOrNull('SMTP_PASSWORD');
        $hasUser = is_string($smtpUserRaw) && $smtpUserRaw !== '';
        $hasPass = is_string($smtpPassRaw) && $smtpPassRaw !== '';
        if ($hasUser !== $hasPass) {
            throw new \RuntimeException('SMTP_USER and SMTP_PASSWORD must both be set or both empty');
        }

        $smtpSecureRaw = Env::stringOrNull('SMTP_SECURE');
        $smtpSecure = '';
        if (is_string($smtpSecureRaw) && trim($smtpSecureRaw) !== '') {
            $low = strtolower(trim($smtpSecureRaw));
            if ($low !== 'tls' && $low !== 'ssl') {
                throw new \RuntimeException('SMTP_SECURE must be empty, tls, or ssl');
            }
            $smtpSecure = $low;
        }

        $mailer = new CertificateMailer(
            $smtpHost,
            $smtpPort,
            $fromAddr,
            'Teilnahmebescheinigungen',
            $hasUser ? $smtpUserRaw : null,
            $hasPass ? $smtpPassRaw : null,
            $smtpSecure,
        );

        $box = Env::base64UrlDecode('SERVER_BOX_KEYPAIR_BASE64');
        if (strlen($box) !== SODIUM_CRYPTO_BOX_SECRETKEYBYTES + SODIUM_CRYPTO_BOX_PUBLICKEYBYTES) {
            throw new \RuntimeException('SERVER_BOX_KEYPAIR_BASE64 must decode to a 64-byte libsodium crypto_box keypair');
        }

        $tutorToken = Env::string('TUTOR_API_TOKEN');
        $tutorEmail = Env::string('TUTOR_EMAIL');

        $publicBase = Env::stringOrNull('PUBLIC_BASE_URL');
        $publicBaseResolved = is_string($publicBase) && rtrim($publicBase, '/') !== ''
            ? rtrim($publicBase, '/')
            : 'http://localhost:7123';

        $responseFactory = AppFactory::determineResponseFactory();
        $app = AppFactory::create($responseFactory);

        $app->addRoutingMiddleware();
        $app->addBodyParsingMiddleware();
        $app->add(new JsonErrorMiddleware());

        $corsRaw = Env::stringOrNull('CORS_ALLOWED_ORIGINS');
        if ($corsRaw !== null && $corsRaw !== '') {
            $allowedOrigins = self::parseCorsAllowedOrigins($corsRaw);
            if ($allowedOrigins !== []) {
                $app->add(new CorsMiddleware($allowedOrigins));
            }
        }

        $errorMiddleware = $app->addErrorMiddleware(false, true, true);
        $errorMiddleware->setDefaultErrorHandler(new ApiJsonErrorHandler($responseFactory), true);

        $bearer = new BearerTokenMiddleware($tutorToken, $responseFactory);

        $health = new HealthAction();
        $serverPk = new ServerPublicKeyAction($signer);
        $createSession = new CreateSessionAction($sessions, $signer, $tokens, $publicBaseResolved, $tutorEmail);
        $enroll = new EnrollAction($signer, $tokens, $sessions, $mailer, $box);
        $verify = new VerifyAction($revocations);
        $revoke = new CreateRevocationAction($signer, $revocations, $sessions);
        $specPath = $apiRootNormalized . '/public/openapi.json';
        $openapi = new OpenApiAction($specPath);

        $app->get('/api/health', $health);
        $app->get('/api/server-public-key', $serverPk);
        $app->get('/api/openapi.json', $openapi);
        $app->get('/api/verify/{certId}', $verify);
        $app->post('/api/enroll/{token}', $enroll);
        $app->post('/api/sessions', $createSession)->add($bearer);
        $app->post('/api/revocations', $revoke)->add($bearer);

        return $app;
    }

    /**
     * @return list<non-empty-string>
     */
    private static function parseCorsAllowedOrigins(string $commaSeparated): array
    {
        $out = [];
        foreach (explode(',', $commaSeparated) as $part) {
            $origin = trim($part);
            if ($origin !== '') {
                $out[] = $origin;
            }
        }

        return $out;
    }
}

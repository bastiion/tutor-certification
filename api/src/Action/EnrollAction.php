<?php

declare(strict_types=1);

namespace App\Action;

use App\Crypto\Signer;
use App\Crypto\Tokens;
use App\Domain\Certificate;
use App\Http\JsonResponder;
use App\Mail\CertificateMailer;
use App\Repository\SessionRepository;
use App\Util\Uuid;
use OpenApi\Attributes as OA;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpGoneException;
use Slim\Exception\HttpNotFoundException;

#[OA\Post(
    path: '/api/enroll/{token}',
    summary: 'Self-issue participation certificate via enrollment token',
    tags: ['public'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(
            properties: [
                new OA\Property(property: 'name', type: 'string'),
                new OA\Property(property: 'email', type: 'string', nullable: true),
            ]
        ),
    ),
    responses: [
        new OA\Response(
            response: '200',
            description: 'Certificate issued',
            content: new OA\JsonContent(ref: '#/components/schemas/Certificate'),
        ),
        new OA\Response(response: '404', description: 'Invalid tampered token'),
        new OA\Response(response: '410', description: 'Expired token'),
        new OA\Response(response: '429', description: 'Rate limited (reserved)'),
    ],
)]
final readonly class EnrollAction
{
    private const CERT_VERSION = 1;

    /** @param non-empty-string $serverBoxKeypair64 */
    public function __construct(
        private Signer $signer,
        private Tokens $tokens,
        private SessionRepository $sessions,
        private CertificateMailer $mail,
        private string $serverBoxKeypair64,
    ) {}

    /** @param array<string, mixed> $args */
    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $routeToken = isset($args['token']) ? (string) $args['token'] : '';
        if ($routeToken === '') {
            throw new HttpNotFoundException($request, 'Enrollment token missing');
        }

        $tokenOpaque = rawurldecode($routeToken);
        $claims = $this->tokens->parseIfMacValid($tokenOpaque);
        if ($claims === null) {
            throw new HttpNotFoundException($request, 'Invalid enrollment token');
        }

        $now = time();
        if ($now > $claims['valid_until_unix']) {
            throw new HttpGoneException($request, 'Enrollment window closed');
        }

        $sessionRow = $this->sessions->findByCourseId($claims['course_id']);
        if ($sessionRow === null) {
            throw new HttpNotFoundException($request, 'Session not available');
        }

        $parsed = $request->getParsedBody();
        if (! is_array($parsed)) {
            throw new HttpBadRequestException($request, 'Expected JSON object body');
        }

        $name = isset($parsed['name']) && is_string($parsed['name']) ? trim($parsed['name']) : '';
        if ($name === '') {
            throw new HttpBadRequestException($request, 'Name is required');
        }

        /** @var array{name: non-empty-string} $participant */
        $participant = ['name' => $name];
        if (array_key_exists('email', $parsed) && $parsed['email'] !== null) {
            $email = $parsed['email'];
            if (! is_string($email)) {
                throw new HttpBadRequestException($request, 'email must be string or null');
            }

            $emailTrim = trim($email);
            if ($emailTrim !== '') {
                $participant['email'] = $emailTrim;
            }
        }

        try {
            $enc = $this->signer->base64UrlDecode($sessionRow->kCoursePrivateEncBase64Url);
        } catch (\Throwable $_) {
            throw new HttpBadRequestException($request, 'Stored session credential encryption field is invalid Base64URL');
        }

        $plain = $this->signer->boxSealOpen($enc, $this->serverBoxKeypair64);
        if ($plain === false || $plain === '') {
            throw new HttpBadRequestException($request, 'Could not decrypt stored course private key for this session');
        }

        if (strlen($plain) !== SODIUM_CRYPTO_SIGN_SECRETKEYBYTES) {
            throw new HttpBadRequestException($request, 'Decrypted course signing key has unexpected length');
        }

        $kCourseSecret64 = $plain;

        try {
            $kCoursePubDecoded = $this->signer->base64UrlDecode($sessionRow->kCoursePublicBase64Url);
        } catch (\Throwable $_) {
            throw new HttpBadRequestException($request, 'Stored K_course_public is invalid Base64URL');
        }

        $expectedPub = $this->signer->ed25519PublicKeyFromSecretKey($kCourseSecret64);
        if (! hash_equals($expectedPub, $kCoursePubDecoded)) {
            throw new HttpBadRequestException($request, 'Course public key mismatch for decrypted secret key');
        }

        $issuedAt = gmdate('c');
        $certId = Uuid::uuidV4();

        $unsigned = new Certificate(
            certId: $certId,
            version: self::CERT_VERSION,
            issuedAt: $issuedAt,
            course: [
                'id' => $sessionRow->courseId,
                'title' => $sessionRow->courseTitle,
                'date' => $sessionRow->courseDate,
            ],
            participant: $participant,
            institute: [
                'name' => $sessionRow->instituteName,
                'key_fingerprint' => $sessionRow->kMasterPublicFingerprintHex,
            ],
            kMasterPublicBase64Url: $sessionRow->kMasterPublicBase64Url,
            kCoursePublicBase64Url: $sessionRow->kCoursePublicBase64Url,
            sessionSigBase64Url: $sessionRow->sessionSigBase64Url,
            sessionValidUntilUnix: $sessionRow->validUntilUnix,
            certificateSigBase64Url: '',
        );

        $signingBytes = $unsigned->toSigningJson();
        $sig = $this->signer->signDetached($signingBytes, $kCourseSecret64);
        $signed = $unsigned->withCertificateSig($this->signer->base64UrlEncode($sig));

        $tutor = $this->sessions->tutorEmailForCourse($sessionRow->courseId);

        if (is_string($tutor) && $tutor !== '') {
            try {
                $this->mail->sendEnrollmentNotification($signed, $tutor);
            } catch (\Throwable $mailErr) {
                error_log('Enrollment mail failed: ' . $mailErr->getMessage());
            }
        }

        return JsonResponder::rawJson($response, $signed->toResponseJson());
    }
}

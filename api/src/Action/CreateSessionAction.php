<?php

declare(strict_types=1);

namespace App\Action;

use App\Crypto\Signer;
use App\Crypto\Tokens;
use App\Domain\SessionCredential;
use App\Http\JsonResponder;
use App\Repository\SessionRepository;
use Fig\Http\Message\StatusCodeInterface;
use OpenApi\Attributes as OA;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpException;

#[OA\Post(
    path: '/api/sessions',
    summary: 'Register tutor session credential',
    security: [['BearerAuth' => []]],
    tags: ['tutor'],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(ref: '#/components/schemas/SessionCredential'),
    ),
    responses: [
        new OA\Response(response: '200', description: 'Session created'),
        new OA\Response(response: '400', description: 'Malformed credential'),
        new OA\Response(response: '409', description: 'Session exists'),
        new OA\Response(response: '401', description: 'Invalid bearer token'),
    ],
)]
final readonly class CreateSessionAction
{
    public function __construct(
        private SessionRepository $sessions,
        private Signer $signer,
        private Tokens $tokens,
        private string $publicBaseUrl,
        private string $tutorEmail,
    ) {}

    /** @param array<string,mixed> $args */
    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        unset($args);

        $parsed = $request->getParsedBody();
        if (! is_array($parsed)) {
            throw new HttpBadRequestException($request, 'Expected JSON object body');
        }

        try {
            $cred = SessionCredential::fromArray($parsed);
        } catch (\InvalidArgumentException $e) {
            throw new HttpBadRequestException($request, $e->getMessage(), $e);
        }

        $masterPk = $this->decodePublicKeyOrBadRequest($request, $cred->kMasterPublicBase64Url);
        $kCoursePub = $this->decodePublicKeyOrBadRequest($request, $cred->kCoursePublicBase64Url);

        $fp = strtolower($cred->kMasterPublicFingerprintHex);
        $computed = $this->signer->masterPublicFingerprintHex($masterPk);
        if (! hash_equals($computed, $fp)) {
            throw new HttpBadRequestException($request, 'K_master_public_fingerprint does not match K_master_public');
        }

        try {
            $sig = $this->signer->base64UrlDecode($cred->sessionSigBase64Url);
        } catch (\Throwable $_) {
            throw new HttpBadRequestException($request, 'session_sig is not valid Base64URL');
        }

        $sessionMsg = $this->signer->sessionEndorsementMessage($cred->courseId, $cred->validUntilUnix, $kCoursePub);
        if (! $this->signer->verifyDetached($sessionMsg, $sig, $masterPk)) {
            throw new HttpBadRequestException($request, 'session_sig verification failed');
        }

        try {
            $this->sessions->insert($cred, $this->tutorEmail);
        } catch (\RuntimeException $e) {
            if (str_contains($e->getMessage(), 'already exists')) {
                throw new HttpException($request, 'Session already exists', StatusCodeInterface::STATUS_CONFLICT, $e);
            }

            throw $e;
        }

        $token = $this->tokens->generate($cred->courseId, $cred->validUntilUnix);
        $url = $this->publicBaseUrl . '/enroll/' . rawurlencode($token);

        return JsonResponder::json($response, [
            'course_id' => $cred->courseId,
            'enroll_url' => $url,
        ]);
    }

    /** @param non-empty-string $b64 */
    private function decodePublicKeyOrBadRequest(ServerRequestInterface $request, string $b64): string
    {
        try {
            $decoded = $this->signer->base64UrlDecode($b64);
        } catch (\Throwable $_) {
            throw new HttpBadRequestException($request, 'Invalid Base64URL public key encoding');
        }

        if ($decoded === '') {
            throw new HttpBadRequestException($request, 'Empty decoded public key');
        }

        return $decoded;
    }
}

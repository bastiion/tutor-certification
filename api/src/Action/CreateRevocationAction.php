<?php

declare(strict_types=1);

namespace App\Action;

use App\Crypto\Signer;
use App\Domain\RevocationDocument;
use App\Http\JsonResponder;
use App\Repository\RevocationRepository;
use App\Repository\SessionRepository;
use Fig\Http\Message\StatusCodeInterface;
use OpenApi\Attributes as OA;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpException;
use Slim\Exception\HttpForbiddenException;
use Slim\Exception\HttpNotFoundException;

#[OA\Post(
    path: '/api/revocations',
    summary: 'Store a tutor-signed revocation document',
    tags: ['tutor'],
    security: [['BearerAuth' => []]],
    requestBody: new OA\RequestBody(
        required: true,
        content: new OA\JsonContent(ref: '#/components/schemas/RevocationDocument'),
    ),
    responses: [
        new OA\Response(response: '200', description: 'Recorded'),
        new OA\Response(response: '400', description: 'Malformed body'),
        new OA\Response(response: '403', description: 'Signature invalid'),
        new OA\Response(response: '409', description: 'Already revoked'),
    ],
)]
final readonly class CreateRevocationAction
{
    public function __construct(
        private Signer $signer,
        private RevocationRepository $revocations,
        private SessionRepository $sessions,
    ) {}

    /** @param array<string, mixed> $args */
    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        unset($args);

        $masters = $this->sessions->distinctMasterPublicKeysBase64Url();
        if ($masters === []) {
            throw new HttpNotFoundException($request, 'No session records trusted for revocation lookups');
        }

        $parsed = $request->getParsedBody();
        if (! is_array($parsed)) {
            throw new HttpBadRequestException($request, 'Expected JSON object body');
        }

        try {
            $doc = RevocationDocument::fromArray($parsed);
        } catch (\InvalidArgumentException $e) {
            throw new HttpBadRequestException($request, $e->getMessage(), $e);
        }

        try {
            $signature = $this->signer->base64UrlDecode($doc->signatureBase64Url);
        } catch (\Throwable $_) {
            throw new HttpBadRequestException($request, 'signature is invalid Base64URL');
        }

        $message = $doc->signedMessageUtf8();
        $verified = false;
        foreach ($masters as $b64) {
            try {
                $pk = $this->signer->base64UrlDecode($b64);
            } catch (\Throwable $_) {
                continue;
            }

            if ($this->signer->verifyDetached($message, $signature, $pk)) {
                $verified = true;

                break;
            }
        }

        if (! $verified) {
            throw new HttpForbiddenException($request, 'Revocation signature could not be verified with any known tutor key');
        }

        try {
            $this->revocations->insert($doc);
        } catch (\RuntimeException $e) {
            if (str_contains($e->getMessage(), 'already exists')) {
                throw new HttpException($request, 'Certificate already revoked', StatusCodeInterface::STATUS_CONFLICT, $e);
            }

            throw $e;
        }

        return JsonResponder::json($response, ['ok' => true]);
    }
}

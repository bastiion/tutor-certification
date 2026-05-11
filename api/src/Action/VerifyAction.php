<?php

declare(strict_types=1);

namespace App\Action;

use App\Http\JsonResponder;
use App\Repository\RevocationRepository;
use OpenApi\Attributes as OA;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Exception\HttpNotFoundException;

#[OA\Get(
    path: '/api/verify/{certId}',
    summary: 'Online revocation probe for a certificate id',
    tags: ['public'],
    responses: [
        new OA\Response(response: '200', description: 'Valid or revoked document'),
        new OA\Response(response: '404', description: 'Malformed cert identifier'),
    ],
)]
final readonly class VerifyAction
{
    public function __construct(
        private RevocationRepository $revocations,
    ) {}

    /** @param array<string, mixed> $args */
    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        $certId = isset($args['certId']) ? trim((string) $args['certId']) : '';
        if ($certId === '') {
            throw new HttpNotFoundException($request, 'Certificate id missing');
        }

        $rev = $this->revocations->findByCertId($certId);
        if ($rev === null) {
            return JsonResponder::json($response, ['valid' => true]);
        }

        return JsonResponder::json($response, [
            'valid' => false,
            'revocation_doc' => $rev->toArray(),
        ]);
    }
}

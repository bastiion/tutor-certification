<?php

declare(strict_types=1);

namespace App\Action;

use App\Crypto\Signer;
use App\Env;
use App\Http\JsonResponder;
use OpenApi\Attributes as OA;
use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;

#[OA\Get(
    path: '/api/server-public-key',
    summary: 'Server X25519 public key for sealed-box encryption',
    tags: ['public'],
    responses: [
        new OA\Response(
            response: '200',
            description: 'Base64URL X25519 public key (32 bytes)',
            content: new OA\JsonContent(
                properties: [new OA\Property(property: 'x25519_pk', type: 'string')],
                required: ['x25519_pk']
            ),
        ),
        new OA\Response(
            response: '503',
            description: 'SERVER_BOX_KEYPAIR_BASE64 missing or invalid',
            content: new OA\JsonContent(
                properties: [
                    new OA\Property(
                        property: 'error',
                        properties: [
                            new OA\Property(property: 'code', type: 'string'),
                            new OA\Property(property: 'message', type: 'string'),
                        ],
                        type: 'object',
                    ),
                ],
                type: 'object',
            ),
        ),
    ],
)]
final readonly class ServerPublicKeyAction
{
    public function __construct(private Signer $signer) {}

    /** @param array<string, mixed> $args */
    public function __invoke(ServerRequestInterface $request, ResponseInterface $response, array $args): ResponseInterface
    {
        unset($request, $args);

        $raw = Env::stringOrNull('SERVER_BOX_KEYPAIR_BASE64');
        if ($raw === null || trim($raw) === '') {
            return JsonResponder::error(
                $response,
                'server-key-unavailable',
                'Server encryption keypair is not configured.',
                503,
            );
        }

        try {
            $bin = $this->signer->base64UrlDecode(trim($raw));
        } catch (\Throwable) {
            return JsonResponder::error(
                $response,
                'server-key-unavailable',
                'Server encryption keypair is malformed.',
                503,
            );
        }

        if (strlen($bin) !== SODIUM_CRYPTO_BOX_SECRETKEYBYTES + SODIUM_CRYPTO_BOX_PUBLICKEYBYTES) {
            return JsonResponder::error(
                $response,
                'server-key-unavailable',
                'Server encryption keypair has unexpected length.',
                503,
            );
        }

        $x25519Public = substr(
            $bin,
            SODIUM_CRYPTO_BOX_SECRETKEYBYTES,
            SODIUM_CRYPTO_BOX_PUBLICKEYBYTES,
        );

        return JsonResponder::json($response, [
            'x25519_pk' => $this->signer->base64UrlEncode($x25519Public),
        ]);
    }
}

<?php

declare(strict_types=1);

namespace App\OpenApi;

use OpenApi\Attributes as OA;

#[OA\Info(
    title: 'Teilnahmebescheinigungen API',
    version: '1.0.0',
)]
#[OA\SecurityScheme(
    securityScheme: 'BearerAuth',
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'opaque token',
)]
final class OpenApiInfo
{
}

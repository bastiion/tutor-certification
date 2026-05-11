<?php

declare(strict_types=1);

use OpenApi\Generator;

describe('OpenAPI spec artefact', function (): void {
    test('public/openapi.json matches Generator::scan(src)', function (): void {
        $apiRoot = dirname(__DIR__, 3);
        $openapi = Generator::scan([$apiRoot . '/src']);
        $generated = $openapi->toJson();
        $committed = file_get_contents($apiRoot . '/public/openapi.json');
        expect($committed)->not->toBeFalse();

        /** @var array<string, mixed> $genArr */
        $genArr = json_decode((string) $generated, true, 512, JSON_THROW_ON_ERROR);
        /** @var array<string, mixed> $comArr */
        $comArr = json_decode((string) $committed, true, 512, JSON_THROW_ON_ERROR);

        expect($genArr)->toEqual($comArr);
    });
});

<?php

declare(strict_types=1);

namespace Tests\Support;

use Psr\Http\Message\ResponseInterface;
use Slim\App;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Factory\StreamFactory;
use Slim\Psr7\Factory\UriFactory;

final class AppRequest
{
    /**
     * @param array<string, string|string[]> $headers
     * @param array<string, mixed>|null      $jsonBody
     */
    public static function dispatch(App $app, string $method, string $path, array $headers = [], ?array $jsonBody = null): ResponseInterface
    {
        $sf = new ServerRequestFactory();
        $streamFactory = new StreamFactory();
        $uri = (new UriFactory())->createUri('http://localhost' . $path);

        $request = $sf->createServerRequest($method, $uri);

        foreach ($headers as $name => $value) {
            $request = $request->withHeader($name, $value);
        }

        if ($jsonBody !== null) {
            $request = $request
                ->withBody($streamFactory->createStream(json_encode($jsonBody, JSON_THROW_ON_ERROR)))
                ->withHeader('Content-Type', 'application/json');
        }

        return $app->handle($request);
    }

    /**
     * @param array<string, string|string[]> $headers
     */
    public static function dispatchWithRawBody(
        App $app,
        string $method,
        string $path,
        array $headers,
        string $rawBody,
        string $contentType = 'application/json',
    ): ResponseInterface {
        $sf = new ServerRequestFactory();
        $streamFactory = new StreamFactory();
        $uri = (new UriFactory())->createUri('http://localhost' . $path);

        $request = $sf->createServerRequest($method, $uri)
            ->withBody($streamFactory->createStream($rawBody))
            ->withHeader('Content-Type', $contentType);

        foreach ($headers as $name => $value) {
            $request = $request->withHeader($name, $value);
        }

        return $app->handle($request);
    }
}

<?php

declare(strict_types=1);

namespace App\Http;

use Fig\Http\Message\StatusCodeInterface;
use Psr\Http\Message\ResponseInterface;
use Slim\Exception\HttpException;
use Slim\Exception\HttpSpecializedException;

/** Slim ErrorMiddleware callable: `{ "error": { code, message } }`; never emits stack traces. */
final class ApiJsonErrorHandler
{
    /** @var array<int,string> */
    private const STATUS_TO_CODE = [
        StatusCodeInterface::STATUS_BAD_REQUEST => 'bad_request',
        StatusCodeInterface::STATUS_UNAUTHORIZED => 'unauthorized',
        StatusCodeInterface::STATUS_FORBIDDEN => 'forbidden',
        StatusCodeInterface::STATUS_NOT_FOUND => 'not_found',
        StatusCodeInterface::STATUS_METHOD_NOT_ALLOWED => 'method_not_allowed',
        StatusCodeInterface::STATUS_CONFLICT => 'conflict',
        StatusCodeInterface::STATUS_GONE => 'gone',
        StatusCodeInterface::STATUS_UNSUPPORTED_MEDIA_TYPE => 'unsupported_media_type',
        StatusCodeInterface::STATUS_TOO_MANY_REQUESTS => 'too_many_requests',
        StatusCodeInterface::STATUS_PAYLOAD_TOO_LARGE => 'payload_too_large',
    ];

    public function __construct(
        private readonly \Psr\Http\Message\ResponseFactoryInterface $factory,
    ) {}

    public function __invoke(
        \Psr\Http\Message\ServerRequestInterface $request,
        \Throwable $exception,
        bool $displayErrorDetails,
        bool $logErrors,
        bool $logErrorDetails,
    ): ResponseInterface {
        unset($request, $displayErrorDetails, $logErrors, $logErrorDetails);

        $response = $this->factory->createResponse();

        $status = StatusCodeInterface::STATUS_INTERNAL_SERVER_ERROR;
        $code = 'internal_error';
        $message = $exception->getMessage();

        if ($exception instanceof HttpException) {
            $candidate = $exception->getCode();
            if ($candidate >= 100 && $candidate <= 599) {
                $status = $candidate;
            }

            if ($message === '' && $exception instanceof HttpSpecializedException) {
                $message = $exception->getDescription();
            }

            $code = self::STATUS_TO_CODE[$status] ?? 'http_error';
        }

        if ($message === '') {
            $message = 'Internal Server Error';
        }

        return JsonResponder::error($response, $code, $message, $status);
    }
}

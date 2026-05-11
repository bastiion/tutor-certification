<?php

declare(strict_types=1);

namespace Tests\Support;

/**
 * Minimal Mailpit REST client for bootstrap integration tests only.
 *
 * @see https://mailpit.axllent.org/docs/api-v1/
 */
final class MailpitHttpClient
{
    public function __construct(
        private readonly string $baseUrl,
    ) {}

    /** @return array<string, mixed> */
    public function listMessagesPayload(): array
    {
        return $this->decodeJsonBody($this->request('GET', '/api/v1/messages'));
    }

    /**
     * @param non-empty-string $messageId
     *
     * @return array<string, mixed>
     */
    public function fetchMessagePayload(string $messageId): array
    {
        return $this->decodeJsonBody($this->request('GET', '/api/v1/message/' . rawurlencode($messageId)));
    }

    public function deleteAllMessages(): void
    {
        $this->request('DELETE', '/api/v1/messages');
    }

    /** @param non-empty-string $path */
    private function request(string $method, string $path): string
    {
        $url = $this->joinUrlPath($path);

        /** @var array{http?: array<string, mixed>} $contextOptions */
        $contextOptions = [
            'http' => [
                'method' => $method,
                'header' => "Accept: application/json\r\n",
                'ignore_errors' => true,
                'timeout' => 15,
            ],
        ];

        $context = stream_context_create($contextOptions);
        /** @var string|false $body */
        $body = @file_get_contents($url, false, $context);

        if ($body === false) {
            throw new \RuntimeException('Mailpit HTTP request failed for ' . $url);
        }

        global $http_response_header;
        /** @var array<int, mixed>|null $headers */
        $headers = isset($http_response_header) && is_array($http_response_header) ? $http_response_header : null;
        $firstHeader = isset($headers[0]) && is_string($headers[0]) ? $headers[0] : null;
        $statusLine = is_string($firstHeader) ? $firstHeader : '';

        if ($statusLine !== '') {
            if (! preg_match('#\s2\d{2}\s#', $statusLine)) {
                throw new \RuntimeException('Mailpit returned non-success for ' . $url . ': ' . trim($statusLine) . ' Body: ' . $body);
            }
        }

        return $body;
    }

    /** @return array<string, mixed> */
    private function decodeJsonBody(string $body): array
    {
        try {
            /** @var mixed $decoded */
            $decoded = json_decode($body, true, flags: JSON_THROW_ON_ERROR);
        } catch (\Throwable) {
            throw new \RuntimeException('Mailpit returned non-JSON response: ' . $body);
        }

        if (! is_array($decoded)) {
            throw new \RuntimeException('Mailpit returned JSON that is not an object');
        }

        /** @var array<string, mixed> $decoded */
        return $decoded;
    }

    /** @param non-empty-string $path */
    private function joinUrlPath(string $path): string
    {
        return rtrim($this->baseUrl, '/') . '/' . ltrim($path, '/');
    }
}

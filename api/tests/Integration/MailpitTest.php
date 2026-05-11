<?php

declare(strict_types=1);

use Tests\Support\MailpitHttpClient;
use Tests\Support\MailpitTestMailer;

test('Mailpit captures SMTP and exposes message via API', function (): void {
    $apiBaseRaw = getenv('MAILPIT_API_BASE');
    expect($apiBaseRaw)->not->toBeFalse()->and($apiBaseRaw)->not->toBe('');

    $smtpHostRaw = getenv('SMTP_HOST');
    $smtpPortRaw = getenv('SMTP_PORT');
    expect($smtpHostRaw)->not->toBeFalse()->and($smtpPortRaw)->not->toBeFalse();

    $apiBase = is_string($apiBaseRaw) ? rtrim($apiBaseRaw, '/') : '';
    expect($apiBase)->not->toBe('');

    $smtpHost = is_string($smtpHostRaw) ? $smtpHostRaw : '';
    $smtpPort = is_numeric($smtpPortRaw) ? (int) $smtpPortRaw : 0;
    expect($smtpPort)->toBeGreaterThan(0);

    $http = new MailpitHttpClient($apiBase);
    $http->deleteAllMessages();

    $mailer = new MailpitTestMailer($smtpHost, $smtpPort);
    $token = 'bootstrap-mail-token-' . bin2hex(random_bytes(8));

    $mailer->sendBootstrapProbe(
        to: 'tutor@example.com',
        subject: 'API bootstrap mail',
        textBody: "Hello\n\n{$token}",
        htmlBody: '<p>Hello</p><p>' . htmlspecialchars($token, ENT_QUOTES | ENT_HTML5, 'UTF-8') . '</p>',
    );

    $messageId = null;
    for ($i = 0; $i < 50; ++$i) {
        $list = $http->listMessagesPayload();
        $messages = $list['messages'] ?? null;
        if (! is_array($messages) || $messages === []) {
            usleep(100_000);
            continue;
        }

        $first = $messages[0] ?? null;
        if (! is_array($first)) {
            usleep(100_000);
            continue;
        }

        $candidate = $first['ID'] ?? null;
        if (is_string($candidate) && $candidate !== '') {
            /** @phpstan-var non-empty-string $candidate */
            $messageId = $candidate;
            break;
        }

        usleep(100_000);
    }

    expect($messageId)->not->toBeNull();
    if ($messageId === null) {
        throw new \RuntimeException('Expected Mailpit message id');
    }

    $detail = $http->fetchMessagePayload($messageId);
    $subject = $detail['Subject'] ?? '';

    expect($subject)->toBeString()->and($subject)->toContain('API bootstrap mail');

    $text = $detail['Text'] ?? '';
    $html = $detail['HTML'] ?? '';
    $haystack = (is_string($text) ? $text : '') . (is_string($html) ? $html : '');
    expect($haystack)->toContain($token);
    // @phpstan-ignore-next-line method.notFound
})->skip(
    fn (): bool => getenv('MAILPIT_INTEGRATION') !== '1',
    <<<'TXT'
MAILPIT_INTEGRATION=1 must be enabled (runs against Mailpit SMTP + HTTP API). Example:
  docker compose up -d mailpit
  docker compose run --rm --entrypoint composer php test:coverage-bootstrap
TXT
);

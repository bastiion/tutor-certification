<?php

declare(strict_types=1);

namespace Tests\Support;

use PHPMailer\PHPMailer\PHPMailer;

/**
 * Sends a single test message to Mailpit (SMTP) for infrastructure checks.
 */
final class MailpitTestMailer
{
    public function __construct(
        private readonly string $smtpHost,
        private readonly int $smtpPort,
    ) {}

    public function sendBootstrapProbe(
        string $to,
        string $subject,
        string $textBody,
        string $htmlBody,
    ): void {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = $this->smtpHost;
        $mail->Port = $this->smtpPort;
        $mail->SMTPAutoTLS = false;
        $mail->SMTPAuth = false;
        $mail->CharSet = PHPMailer::CHARSET_UTF8;

        $mail->setFrom('bootstrap-test@example.test', 'Bootstrap Test');
        $mail->addAddress($to);
        $mail->Subject = $subject;
        $mail->isHTML(true);
        $mail->Body = $htmlBody;
        $mail->AltBody = $textBody;

        if (! $mail->send()) {
            throw new \RuntimeException($mail->ErrorInfo ?: 'SMTP send failed');
        }
    }
}

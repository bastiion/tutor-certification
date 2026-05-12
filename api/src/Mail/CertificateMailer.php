<?php

declare(strict_types=1);

namespace App\Mail;

use App\Domain\Certificate;
use PHPMailer\PHPMailer\PHPMailer;

final class CertificateMailer
{
    public function __construct(
        private readonly string $smtpHost,
        private readonly int $smtpPort,
        private readonly string $fromAddress,
        private readonly string $fromName = 'Teilnahmebescheinigungen',
        private readonly ?string $smtpUsername = null,
        private readonly ?string $smtpPassword = null,
        private readonly string $smtpSecure = '',
    ) {}

    /** @throws \PHPMailer\PHPMailer\Exception */
    public function sendEnrollmentNotification(Certificate $cert, string $tutorEmail): void
    {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $this->applySmtpTransport($mail);

        $mail->CharSet = PHPMailer::CHARSET_UTF8;

        $mail->setFrom($this->fromAddress, $this->fromName);
        $mail->addAddress($tutorEmail);

        $mail->Subject = 'Neue Teilnahmebescheinigung ausgestellt';

        $jsonAttachment = $cert->toResponseJson();
        $fileName = $cert->certId . '.cert.json';

        $bodyText = <<<TXT
Ein Teilnehmer hat gerade eine Teilnahmebescheinigung für den Kurs „{$cert->course['title']}“ ausgestellt.

Name: {$cert->participant['name']}

Ausgestellt: {$cert->issuedAt}

Die vollständigen Zertifikatsdaten (JSON) befinden sich im Anhang („{$fileName}“).
TXT;

        $nameEsc = htmlspecialchars($cert->participant['name'], ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $titleEsc = htmlspecialchars($cert->course['title'], ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $htmlBody = <<<HTML
<p>Hallo,</p>
<p>ein Teilnehmer hat gerade eine Teilnahmebescheinigung für den Kurs „{$titleEsc}“ ausgestellt.</p>
<p><strong>Name:</strong> {$nameEsc}<br>
<strong>Ausgestellt:</strong> {$cert->issuedAt}</p>
<p>Die vollständigen Zertifikatsdaten (JSON) befinden sich im Anhang (<code>{$fileName}</code>).</p>
HTML;

        $mail->isHTML(true);
        $mail->Body = $htmlBody;
        $mail->AltBody = $bodyText;
        $mail->addStringAttachment($jsonAttachment, $fileName, 'base64', 'application/json');

        $mail->send();
    }

    private function applySmtpTransport(PHPMailer $mail): void
    {
        $mail->Host = $this->smtpHost;
        $mail->Port = $this->smtpPort;

        $secure = $this->smtpSecure;
        if ($secure === 'tls') {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
            $mail->SMTPAutoTLS = true;
        } elseif ($secure === 'ssl') {
            $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
            $mail->SMTPAutoTLS = false;
        } else {
            $mail->SMTPSecure = '';
            $mail->SMTPAutoTLS = false;
        }

        $user = $this->smtpUsername ?? '';
        $pass = $this->smtpPassword ?? '';
        $useAuth = $user !== '' && $pass !== '';
        $mail->SMTPAuth = $useAuth;
        if ($useAuth) {
            $mail->Username = $user;
            $mail->Password = $pass;
        }
    }
}

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
    ) {}

    /** @throws \PHPMailer\PHPMailer\Exception */
    public function sendEnrollmentNotification(Certificate $cert, string $tutorEmail): void
    {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = $this->smtpHost;
        $mail->Port = $this->smtpPort;
        $mail->SMTPAutoTLS = false;
        $mail->SMTPAuth = false;
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
}

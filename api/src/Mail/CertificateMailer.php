<?php

declare(strict_types=1);

namespace App\Mail;

use App\Domain\Certificate;
use App\Domain\RevocationDocument;
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

    private static function shouldAttachDistinctBcc(string $primaryTo, ?string $bccCandidate): bool
    {
        if ($bccCandidate === null) {
            return false;
        }

        $bcc = trim($bccCandidate);

        return $bcc !== '' && strcasecmp(trim($primaryTo), $bcc) !== 0;
    }

    /** @throws \PHPMailer\PHPMailer\Exception */
    public function sendEnrollmentNotification(Certificate $cert, string $tutorEmail, ?string $bccBackup): void
    {
        $mail = $this->newMailerPrepared();
        $mail->setFrom($this->fromAddress, $this->fromName);
        $mail->addAddress($tutorEmail);

        if (self::shouldAttachDistinctBcc($tutorEmail, $bccBackup)) {
            $mail->addBCC(trim((string) $bccBackup));
        }

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

    /**
     * @throws \PHPMailer\PHPMailer\Exception
     */
    public function sendRevocationNotification(
        RevocationDocument $doc,
        string $toAddress,
        ?string $bccAddress,
    ): void {

        $mail = $this->newMailerPrepared();
        $mail->setFrom($this->fromAddress, $this->fromName);
        $mail->addAddress($toAddress);

        if (self::shouldAttachDistinctBcc($toAddress, $bccAddress)) {
            $mail->addBCC(trim((string) $bccAddress));
        }

        $certIdHex = strtolower(str_replace(['-', '{', '}'], '', $doc->certId));
        $certIdShort = strlen($certIdHex) >= 8 ? substr($certIdHex, 0, 8) : $certIdHex;
        $mail->Subject = 'Sperrung der Bescheinigung ' . $certIdShort;

        try {
            $payload = json_encode($doc->toArray(), JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (\JsonException $e) {
            throw new \RuntimeException('Revocation attachment JSON encode failed', 0, $e);
        }

        $attachName = 'widerruf-' . $doc->certId . '.json';

        $reasonEscHtml = htmlspecialchars($doc->reason, ENT_QUOTES | ENT_HTML5, 'UTF-8');

        $bodyText = <<<TXT
Eine Teilnahmebescheinigung wurde widerrufen.

Zertifikats-ID: {$doc->certId}
Zeitpunkt: {$doc->revokedAt}
Grund: {$doc->reason}

Bewahren Sie diese E-Mail auf. Falls der Server zurückgesetzt wird, können Sie die Sperrungen aus diesen E-Mails wieder in den Server einspielen.

Das signierte Sperrungs-Dokument (JSON) liegt im Anhang („{$attachName}“).
TXT;

        $htmlBody = <<<HTML
<p>Hallo,</p>
<p>eine Teilnahmebescheinigung wurde widerrufen.</p>
<p><strong>Zertifikats-ID:</strong> {$doc->certId}<br>
<strong>Zeitpunkt:</strong> {$doc->revokedAt}<br>
<strong>Grund:</strong> {$reasonEscHtml}</p>
<p>Bewahren Sie diese E-Mail auf. Falls der Server zurückgesetzt wird, können Sie die Sperrungen aus diesen E-Mails wieder in den Server einspielen.</p>
<p>Das signierte Sperrungs-Dokument (JSON) liegt im Anhang (<code>{$attachName}</code>).</p>
HTML;

        $mail->isHTML(true);
        $mail->Body = $htmlBody;
        $mail->AltBody = $bodyText;
        $mail->addStringAttachment($payload, $attachName, 'base64', 'application/json');

        $mail->send();
    }

    /** @throws \PHPMailer\PHPMailer\Exception */
    private function newMailerPrepared(): PHPMailer
    {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $this->applySmtpTransport($mail);
        $mail->CharSet = PHPMailer::CHARSET_UTF8;

        return $mail;
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

<?php

declare(strict_types=1);

namespace App\Domain;

use OpenApi\Attributes as OA;

#[OA\Schema(
    schema: 'Certificate',
    required: [
        'cert_id',
        'version',
        'issued_at',
        'course',
        'participant',
        'institute',
        'K_course_public',
        'session_sig',
        'certificate_sig',
    ]
)]
final readonly class Certificate
{
    /**
     * @param array{id: non-empty-string, title: string, date: non-empty-string} $course
     * @param array{name: non-empty-string, email?: string}                    $participant
     * @param array{name: non-empty-string, key_fingerprint: non-empty-string} $institute
     */
    public function __construct(
        #[OA\Property(format: 'uuid')]
        public string $certId,
        public int $version,
        #[OA\Property(example: '2026-05-11T14:28:00+00:00')]
        public string $issuedAt,
        #[OA\Property(properties: [], type: 'object')]
        public array $course,
        #[OA\Property(properties: [], type: 'object')]
        public array $participant,
        #[OA\Property(properties: [], type: 'object')]
        public array $institute,
        #[OA\Property(description: 'Ed25519 public (Base64URL)')]
        public string $kCoursePublicBase64Url,
        #[OA\Property(description: 'Detached endorsement signature (Base64URL)')]
        public string $sessionSigBase64Url,
        #[OA\Property(description: 'Detached certificate signature (Base64URL)')]
        public string $certificateSigBase64Url,
    ) {}

    /** Canonical JSON signing input: entire payload omitting certificate_sig key. */
    public function toSigningJson(): string
    {
        /** @phpstan-ignore-next-line redundant */
        $blob = [
            'cert_id' => $this->certId,
            'version' => $this->version,
            'issued_at' => $this->issuedAt,
            'course' => [
                'id' => $this->course['id'],
                'title' => $this->course['title'],
                'date' => $this->course['date'],
            ],
            'participant' => $this->canonicalParticipantSlice(),
            'institute' => [
                'name' => $this->institute['name'],
                'key_fingerprint' => $this->institute['key_fingerprint'],
            ],
            'K_course_public' => $this->kCoursePublicBase64Url,
            'session_sig' => $this->sessionSigBase64Url,
        ];

        try {
            $json = json_encode($blob, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (\JsonException $e) {
            throw new \RuntimeException('Certificate signing JSON encode failed', 0, $e);
        }

        return $json;
    }

    public function withCertificateSig(string $sigB64Url): Certificate
    {
        return new self(
            certId: $this->certId,
            version: $this->version,
            issuedAt: $this->issuedAt,
            course: $this->course,
            participant: $this->participant,
            institute: $this->institute,
            kCoursePublicBase64Url: $this->kCoursePublicBase64Url,
            sessionSigBase64Url: $this->sessionSigBase64Url,
            certificateSigBase64Url: $sigB64Url,
        );
    }

    /** Full response JSON including certificate_sig. */
    public function toResponseJson(): string
    {
        $blob = [
            'cert_id' => $this->certId,
            'version' => $this->version,
            'issued_at' => $this->issuedAt,
            'course' => [
                'id' => $this->course['id'],
                'title' => $this->course['title'],
                'date' => $this->course['date'],
            ],
            'participant' => $this->canonicalParticipantSlice(),
            'institute' => [
                'name' => $this->institute['name'],
                'key_fingerprint' => $this->institute['key_fingerprint'],
            ],
            'K_course_public' => $this->kCoursePublicBase64Url,
            'session_sig' => $this->sessionSigBase64Url,
            'certificate_sig' => $this->certificateSigBase64Url,
        ];

        try {
            return json_encode($blob, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (\JsonException $e) {
            throw new \RuntimeException('Certificate JSON encode failed', 0, $e);
        }
    }

    /**
     * @return array{name: string, email?: string}
     */
    private function canonicalParticipantSlice(): array
    {
        $out = ['name' => $this->participant['name']];
        if (isset($this->participant['email']) && $this->participant['email'] !== '') {
            $out['email'] = $this->participant['email'];
        }

        return $out;
    }
}

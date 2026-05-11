<?php

declare(strict_types=1);

namespace App\Domain;

use OpenApi\Attributes as OA;

#[OA\Schema(
    schema: 'SessionCredential',
    required: [
        'course_id',
        'valid_until',
        'course_title',
        'course_date',
        'institute_name',
        'K_master_public',
        'K_course_public',
        'K_master_public_fingerprint',
        'session_sig',
        'K_course_private_enc',
    ]
)]
final readonly class SessionCredential
{
    /** @param non-empty-string $courseId */
    public function __construct(
        #[OA\Property(example: '018f5b2e-4b2a-7000-9000-abcdef123456')]
        public string $courseId,
        public int $validUntilUnix,
        public string $courseTitle,
        public string $courseDate,
        public string $instituteName,
        #[OA\Property(description: 'Ed25519 K_master_public, Base64URL no padding')]
        public string $kMasterPublicBase64Url,
        #[OA\Property(description: 'Ed25519 K_course_public, Base64URL no padding')]
        public string $kCoursePublicBase64Url,
        #[OA\Property(description: 'SHA-256 hex (lowercase) of K_master_public raw bytes')]
        public string $kMasterPublicFingerprintHex,
        #[OA\Property(description: 'Detached Ed25519 signature (Base64URL)')]
        public string $sessionSigBase64Url,
        #[OA\Property(description: 'NaCl sealed box ciphertext (Base64URL)')]
        public string $kCoursePrivateEncBase64Url,
    ) {}

    /** @param array<string, mixed> $data */
    public static function fromArray(array $data): self
    {
        $allowedKeys = [
            'course_id' => true,
            'valid_until' => true,
            'course_title' => true,
            'course_date' => true,
            'institute_name' => true,
            'K_master_public' => true,
            'K_course_public' => true,
            'K_master_public_fingerprint' => true,
            'session_sig' => true,
            'K_course_private_enc' => true,
        ];

        foreach (array_diff_key($data, $allowedKeys) as $k => $_) {
            throw new \InvalidArgumentException('Unexpected field in session credential: ' . (string) $k);
        }

        foreach (array_diff_key($allowedKeys, $data) as $k => $_) {
            throw new \InvalidArgumentException('Missing session credential field: ' . $k);
        }

        $courseId = $data['course_id'];
        if (! is_string($courseId) || trim($courseId, " \t\n\r") === '') {
            throw new \InvalidArgumentException('course_id must be non-empty string');
        }

        $validUntilRaw = $data['valid_until'] ?? null;
        if (! is_int($validUntilRaw) && ! is_float($validUntilRaw)) {
            throw new \InvalidArgumentException('valid_until must be a number');
        }

        $validUntilInt = (int) $validUntilRaw;
        if ($validUntilInt < 0 || (float) $validUntilInt !== (float) $validUntilRaw) {
            throw new \InvalidArgumentException('valid_until must be a non-negative integer');
        }

        foreach ([
            'course_title' => $data['course_title'] ?? null,
            'course_date' => $data['course_date'] ?? null,
            'institute_name' => $data['institute_name'] ?? null,
        ] as $key => $v) {
            if (! is_string($v)) {
                throw new \InvalidArgumentException($key . ' must be string');
            }
        }

        foreach ([
            'K_master_public' => $data['K_master_public'] ?? null,
            'K_course_public' => $data['K_course_public'] ?? null,
            'session_sig' => $data['session_sig'] ?? null,
            'K_course_private_enc' => $data['K_course_private_enc'] ?? null,
        ] as $key => $v) {
            if (! is_string($v) || $v === '') {
                throw new \InvalidArgumentException($key . ' must be non-empty string');
            }
        }

        $fpRaw = $data['K_master_public_fingerprint'];
        if (! is_string($fpRaw)) {
            throw new \InvalidArgumentException('K_master_public_fingerprint must be string');
        }

        $fp = strtolower($fpRaw);
        if (! preg_match('/^[a-f0-9]{64}$/', $fp)) {
            throw new \InvalidArgumentException('K_master_public_fingerprint must be 64 hex chars');
        }

        return new self(
            courseId: $courseId,
            validUntilUnix: $validUntilInt,
            courseTitle: (string) $data['course_title'],
            courseDate: (string) $data['course_date'],
            instituteName: (string) $data['institute_name'],
            kMasterPublicBase64Url: (string) $data['K_master_public'],
            kCoursePublicBase64Url: (string) $data['K_course_public'],
            kMasterPublicFingerprintHex: $fp,
            sessionSigBase64Url: (string) $data['session_sig'],
            kCoursePrivateEncBase64Url: (string) $data['K_course_private_enc'],
        );
    }
}

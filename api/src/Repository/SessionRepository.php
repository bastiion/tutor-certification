<?php

declare(strict_types=1);

namespace App\Repository;

use App\Crypto\Signer;
use App\Domain\SessionCredential;
use PDO;
use PDOException;

final class SessionRepository
{
    public function __construct(
        private readonly PDO $pdo,
        private readonly Signer $signer,
    ) {}

    public function insert(SessionCredential $c, string $tutorEmail): void
    {
        $sql = <<<'SQL'
            INSERT INTO sessions (
                id,
                course_title,
                course_date,
                institute_name,
                k_master_pub,
                k_course_pub,
                session_sig,
                k_course_priv_enc,
                valid_until,
                tutor_email
            ) VALUES (
                :id,
                :course_title,
                :course_date,
                :institute_name,
                :k_master_pub,
                :k_course_pub,
                :session_sig,
                :k_course_priv_enc,
                :valid_until,
                :tutor_email
            )
            SQL;

        $stmt = $this->pdo->prepare($sql);
        try {
            $stmt->execute([
                ':id' => $c->courseId,
                ':course_title' => $c->courseTitle,
                ':course_date' => $c->courseDate,
                ':institute_name' => $c->instituteName,
                ':k_master_pub' => $c->kMasterPublicBase64Url,
                ':k_course_pub' => $c->kCoursePublicBase64Url,
                ':session_sig' => $c->sessionSigBase64Url,
                ':k_course_priv_enc' => $c->kCoursePrivateEncBase64Url,
                ':valid_until' => $c->validUntilUnix,
                ':tutor_email' => $tutorEmail,
            ]);
        } catch (PDOException $e) {
            if ($e->getCode() === '23000' || str_contains($e->getMessage(), 'UNIQUE')) {
                throw new \RuntimeException('Session already exists', 0, $e);
            }

            throw $e;
        }
    }

    public function findByCourseId(string $courseId): ?SessionCredential
    {
        $stmt = $this->pdo->prepare(
            'SELECT id, course_title, course_date, institute_name, k_master_pub, k_course_pub, session_sig, k_course_priv_enc, valid_until
             FROM sessions WHERE id = :id LIMIT 1',
        );
        $stmt->execute([':id' => $courseId]);
        /** @var array<string, mixed>|false $row */
        $row = $stmt->fetch();
        if ($row === false) {
            return null;
        }

        try {
            $masterPk = $this->signer->base64UrlDecode((string) $row['k_master_pub']);
        } catch (\Throwable) {
            return null;
        }

        $fp = $this->signer->masterPublicFingerprintHex($masterPk);

        return new SessionCredential(
            courseId: (string) $row['id'],
            validUntilUnix: (int) $row['valid_until'],
            courseTitle: (string) $row['course_title'],
            courseDate: (string) $row['course_date'],
            instituteName: (string) $row['institute_name'],
            kMasterPublicBase64Url: (string) $row['k_master_pub'],
            kCoursePublicBase64Url: (string) $row['k_course_pub'],
            kMasterPublicFingerprintHex: $fp,
            sessionSigBase64Url: (string) $row['session_sig'],
            kCoursePrivateEncBase64Url: (string) $row['k_course_priv_enc'],
        );
    }

    /**
     * Distinct K_master_public values (Base64URL) ever stored.
     *
     * @return list<non-empty-string>
     */
    public function distinctMasterPublicKeysBase64Url(): array
    {
        $stmt = $this->pdo->query('SELECT DISTINCT k_master_pub FROM sessions');
        if ($stmt === false) {
            return [];
        }

        $out = [];
        while (($row = $stmt->fetch()) !== false) {
            $k = $row['k_master_pub'] ?? '';
            if (is_string($k) && $k !== '') {
                $out[] = $k;
            }
        }

        return $out;
    }

    /** Tutor inbox target for this course session row. */
    public function tutorEmailForCourse(string $courseId): ?string
    {
        $stmt = $this->pdo->prepare('SELECT tutor_email FROM sessions WHERE id = :id LIMIT 1');
        $stmt->execute([':id' => $courseId]);
        $email = $stmt->fetchColumn();
        if ($email === false || ! is_string($email) || $email === '') {
            return null;
        }

        return $email;
    }
}

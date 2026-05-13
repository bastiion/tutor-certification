import { z } from "zod";

const iso8601Like = z.string().min(1);

/** Eleven-field certificate wire shape (Stage 4 / PHP {@see Certificate::toResponseJson}). */
export const certificateWireSchema = z
  .object({
    cert_id: z.string().uuid(),
    schema_version: z.literal(1),
    issued_at: iso8601Like,
    course: z
      .object({
        id: z.string().min(1),
        title: z.string(),
        date: z.string().min(1),
      })
      .strict(),
    participant: z
      .object({
        name: z.string().min(1),
        email: z.string().min(1).optional(),
      })
      .strict(),
    institute: z
      .object({
        name: z.string().min(1),
        key_fingerprint: z.string().min(1),
      })
      .strict(),
    K_master_public: z.string().min(1),
    K_course_public: z.string().min(1),
    session_sig: z.string().min(1),
    valid_until: z.number().int().positive(),
    certificate_sig: z.string().min(1),
  })
  .strict();

export type CertificateWire = z.infer<typeof certificateWireSchema>;

export const revocationDocSchema = z
  .object({
    cert_id: z.string().min(1),
    revoked_at: z.string().min(1),
    reason: z.string().min(1),
    signature: z.string().min(1),
    schema_version: z.literal(1),
  })
  .strict();

export type RevocationDocWire = z.infer<typeof revocationDocSchema>;

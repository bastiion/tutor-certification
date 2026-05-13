import {
  base64urlDecode,
  masterPublicFingerprintHex,
  ready,
  sessionEndorsementMessage,
  verifyDetached,
} from "@bastiion/crypto";
import { z } from "zod";

const certLikeSchema = z.object({
  cert_id: z.string().min(1),
  schema_version: z.literal(1),
  course: z.object({
    id: z.string().min(1),
  }),
  institute: z.object({
    key_fingerprint: z.string().min(1),
  }),
  K_master_public: z.string().min(1),
  K_course_public: z.string().min(1),
  session_sig: z.string().min(1),
  valid_until: z.number().int().nonnegative(),
  certificate_sig: z.string().min(1),
});

export type ParsedEnrollmentCertificate = z.infer<typeof certLikeSchema>;

export type VerifyIssuedCertResult =
  | { ok: true; cert: ParsedEnrollmentCertificate }
  | { ok: false; reason: "parse" | "session_sig" | "fingerprint_mismatch" | "schema" };

export async function verifyIssuedCertificate(rawBody: string): Promise<VerifyIssuedCertResult> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return { ok: false, reason: "parse" };
  }

  const decoded = certLikeSchema.safeParse(parsed);
  if (!decoded.success) {
    return { ok: false, reason: "schema" };
  }

  const cert = decoded.data;

  await ready();

  let kMasterRaw: Uint8Array;
  let kCourseRaw: Uint8Array;
  let sessionSigRaw: Uint8Array;
  try {
    kMasterRaw = base64urlDecode(cert.K_master_public);
    kCourseRaw = base64urlDecode(cert.K_course_public);
    sessionSigRaw = base64urlDecode(cert.session_sig);
  } catch {
    return { ok: false, reason: "schema" };
  }

  const message = sessionEndorsementMessage(cert.course.id, cert.valid_until, kCourseRaw);
  const sessionOk = await verifyDetached(sessionSigRaw, message, kMasterRaw);

  if (!sessionOk) {
    return { ok: false, reason: "session_sig" };
  }

  const fp = masterPublicFingerprintHex(kMasterRaw);
  if (fp !== cert.institute.key_fingerprint) {
    return { ok: false, reason: "fingerprint_mismatch" };
  }

  return { ok: true, cert };
}

/**
 * Parsed JSON for UI rendering (looser than {@link verifyIssuedCertificate} gate).
 * Call only after verification succeeded.
 */
export function parseCertificateForDisplay(rawBody: string): {
  participantName: string;
  courseTitle: string;
  courseDate: string;
  instituteName: string;
  certId: string;
  keyFingerprint: string;
} {
  const parsed = JSON.parse(rawBody) as {
    cert_id?: string;
    participant?: { name?: string };
    course?: { title?: string; date?: string };
    institute?: { name?: string; key_fingerprint?: string };
  };
  return {
    certId: typeof parsed.cert_id === "string" ? parsed.cert_id : "",
    participantName: typeof parsed.participant?.name === "string" ? parsed.participant.name : "",
    courseTitle: typeof parsed.course?.title === "string" ? parsed.course.title : "",
    courseDate: typeof parsed.course?.date === "string" ? parsed.course.date : "",
    instituteName: typeof parsed.institute?.name === "string" ? parsed.institute.name : "",
    keyFingerprint: typeof parsed.institute?.key_fingerprint === "string" ? parsed.institute.key_fingerprint : "",
  };
}

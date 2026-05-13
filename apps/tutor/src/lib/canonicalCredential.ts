/**
 * Canonical session-credential builder for the tutor SPA.
 *
 * Produces the exact `snake_case` payload that
 * [`SessionCredential::fromArray`](../../../../api/src/Domain/SessionCredential.php)
 * accepts on `POST /api/sessions`, including:
 *
 * - `K_master_public` (32-byte Ed25519 key)
 * - `tutor_email` (**An:** for issuance/revocation mail; env `TUTOR_EMAIL` ist BCC, falls abweichend)
 * - `K_course_public` (derived via HKDF + Ed25519 seed → keypair)
 * - `K_master_public_fingerprint` (BLAKE2b-256 hex of `K_master_public`)
 * - `session_sig` (`course_id ‖ valid_until_be_u64 ‖ K_course_public` signed with `K_master`)
 * - `K_course_private_enc` (NaCl sealed box of the 64-byte course secret key
 *   to the server's X25519 public key)
 *
 * The function is **pure** — no DOM, no fetch, no storage. Callers are
 * responsible for calling {@link import("@bastiion/crypto").ready} once at
 * app boot before invoking it.
 */

import {
  base64urlEncode,
  boxSeal,
  deriveSessionSeed,
  keypairFromSeed,
  masterPublicFingerprintHex,
  sessionEndorsementMessage,
  signDetached,
} from "@bastiion/crypto";

/** Inputs for {@link buildCanonicalSessionCredential}. */
export interface SessionInputs {
  /** Course identifier (UUID v4 or any non-empty string accepted by the backend). */
  courseId: string;
  /** Expiry instant in seconds since Unix epoch (non-negative integer). */
  validUntilUnix: number;
  /** Human-readable course title (free text). */
  courseTitle: string;
  /** Course date as `YYYY-MM-DD`. */
  courseDate: string;
  /** Issuing institute display name. */
  instituteName: string;
  /** Tutor contact email — currently used by callers for UX, not by the wire payload. */
  tutorEmail: string;
  /** Raw 32-byte `K_master` Ed25519 seed; never persisted by the SPA. */
  kMasterSeed: Uint8Array;
  /** Server X25519 public key (32 bytes), as fetched from `/api/server-public-key`. */
  serverBoxPublicKey: Uint8Array;
}

/** Snake-case credential payload sent to `POST /api/sessions`. */
export interface SessionCredentialJson {
  course_id: string;
  valid_until: number;
  course_title: string;
  course_date: string;
  institute_name: string;
  tutor_email: string;
  K_master_public: string;
  K_course_public: string;
  K_master_public_fingerprint: string;
  session_sig: string;
  K_course_private_enc: string;
}

const ED25519_SEED_BYTES = 32;
const X25519_PUBKEY_BYTES = 32;
const COURSE_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
/** RFC 4648 §5 alphabet, no padding. */
const BASE64URL_NO_PAD_RE = /^[A-Za-z0-9_-]+$/;

function ensureNonEmpty(value: string, field: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${field} must be a non-empty string`);
  }
}

function ensureBytes(value: Uint8Array, expectedLen: number, field: string): void {
  if (!(value instanceof Uint8Array)) {
    throw new TypeError(`${field} must be a Uint8Array`);
  }
  if (value.length !== expectedLen) {
    throw new RangeError(`${field} must be exactly ${expectedLen} bytes`);
  }
}

/**
 * Validate that all session inputs are well-formed before any crypto runs.
 *
 * Surfacing typed errors here keeps the React form fast and lets the unit
 * tests cover the negative paths cheaply.
 */
export function validateSessionInputs(inputs: SessionInputs): void {
  ensureNonEmpty(inputs.courseId, "courseId");

  if (!Number.isInteger(inputs.validUntilUnix) || inputs.validUntilUnix < 0) {
    throw new RangeError("validUntilUnix must be a non-negative integer (seconds)");
  }

  ensureNonEmpty(inputs.courseTitle, "courseTitle");
  ensureNonEmpty(inputs.courseDate, "courseDate");
  if (!COURSE_DATE_RE.test(inputs.courseDate)) {
    throw new RangeError("courseDate must match YYYY-MM-DD");
  }

  ensureNonEmpty(inputs.instituteName, "instituteName");
  ensureNonEmpty(inputs.tutorEmail, "tutorEmail");

  ensureBytes(inputs.kMasterSeed, ED25519_SEED_BYTES, "kMasterSeed");
  ensureBytes(inputs.serverBoxPublicKey, X25519_PUBKEY_BYTES, "serverBoxPublicKey");
}

/**
 * Build the canonical snake_case credential payload that
 * `POST /api/sessions` consumes.
 *
 * Performs all crypto steps in order:
 * 1. Derive `K_master` keypair from the supplied 32-byte seed.
 * 2. HKDF-derive the per-course Ed25519 seed and turn it into a keypair.
 * 3. Build the session endorsement message and sign it with `K_master`.
 * 4. Sealed-box-encrypt the 64-byte course secret key for the server.
 * 5. Base64URL-encode every binary field (no padding).
 */
export async function buildCanonicalSessionCredential(
  inputs: SessionInputs,
): Promise<SessionCredentialJson> {
  validateSessionInputs(inputs);

  const masterKp = await keypairFromSeed(inputs.kMasterSeed);

  const courseSeed = await deriveSessionSeed({
    ikm: inputs.kMasterSeed,
    courseId: inputs.courseId,
    validUntilUnix: inputs.validUntilUnix,
  });
  const courseKp = await keypairFromSeed(courseSeed);

  const endorsement = sessionEndorsementMessage(
    inputs.courseId,
    inputs.validUntilUnix,
    courseKp.publicKey,
  );
  const sessionSig = await signDetached(endorsement, masterKp.secretKey);

  const sealed = await boxSeal(courseKp.secretKey, inputs.serverBoxPublicKey);

  return {
    course_id: inputs.courseId,
    valid_until: inputs.validUntilUnix,
    course_title: inputs.courseTitle,
    course_date: inputs.courseDate,
    institute_name: inputs.instituteName,
    tutor_email: inputs.tutorEmail.trim(),
    K_master_public: base64urlEncode(masterKp.publicKey),
    K_course_public: base64urlEncode(courseKp.publicKey),
    K_master_public_fingerprint: masterPublicFingerprintHex(masterKp.publicKey),
    session_sig: base64urlEncode(sessionSig),
    K_course_private_enc: base64urlEncode(sealed),
  };
}

/** Convenience guard for the {@link SessionCredentialJson} alphabet (used in tests). */
export function isBase64UrlNoPadding(value: string): boolean {
  return typeof value === "string" && BASE64URL_NO_PAD_RE.test(value);
}

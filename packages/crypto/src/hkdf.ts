/**
 * Derives a deterministic per-session seed (`K_course` private seed) from the tutor's master
 * secret using HKDF‑SHA256 ([RFC 5869](https://www.rfc-editor.org/rfc/rfc5869)).
 *
 * The `info` field is exactly as in the product concept — it ties the output to a specific
 * `course_id` and `valid_until`, so a leaked session key cannot simply be replayed for another
 * enrolment window later.
 *
 * The implementation uses the platform WebCrypto HKDF (`crypto.subtle`). The `salt` parameter
 * is an empty octet string, matching the planned PHP `hash_hkdf` glue in Stage 2.
 */

import { buildCertCourseHkdfInfo } from "./hkdf-info.ts";

/** HKDF inputs aligned with the session credential design. */
export interface HkdfInput {
  /** Input keying material — in this product, raw `K_master_private` bytes (typically 32 octets). */
  ikm: Uint8Array;
  /** Course/session identifier (often a UUID string). */
  courseId: string;
  /** Unix expiry instant in seconds (`valid_until`), encoded as big-endian u64 inside `info`. */
  validUntilUnix: number;
  /** Output length in bytes; defaults to 32 (Ed25519 seed size). */
  length?: 32;
}

/**
 * Produce the per-course Ed25519 seed by expanding `ikm` with HKDF‑SHA256 (empty salt).
 *
 * @param input - `ikm`, `courseId`, and `validUntilUnix` as described above; optional `length`.
 * @returns A new `Uint8Array` of length `input.length ?? 32`.
 * @throws {RangeError} if `validUntilUnix` is negative, non-integer, or does not fit unsigned 64‑bit.
 * @example
 * ```ts
 * const seed = await deriveSessionSeed({
 *   ikm: masterPrivate,
 *   courseId: "018f5b2e-4b2a-7000-9000-abcdef123456",
 *   validUntilUnix: 1_780_000_000,
 * });
 * ```
 * @see [Concept — Key Derivation: HKDF](../../../../doc/plan/key-signing-courses-plan.md)
 * @remarks Never log `ikm`, the returned seed, or any derived private key material.
 */
export async function deriveSessionSeed(input: HkdfInput): Promise<Uint8Array> {
  const length = input.length ?? 32;
  if (length !== 32) {
    throw new RangeError("deriveSessionSeed: only length 32 is supported in this MVP stage");
  }
  const info = buildCertCourseHkdfInfo(input.courseId, input.validUntilUnix);

  const ikmBytes = new Uint8Array(input.ikm);

  const hkdfKey = await crypto.subtle.importKey("raw", ikmBytes, "HKDF", false, ["deriveBits"]);

  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info,
    },
    hkdfKey,
    length * 8,
  );

  return new Uint8Array(bits);
}

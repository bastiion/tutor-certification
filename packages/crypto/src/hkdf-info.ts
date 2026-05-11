const HKDF_SESSION_LABEL = new TextEncoder().encode("cert-course-key");

/**
 * Builds the HKDF **`info`** octet string binding a derived tutor key (`K_course` seed material)
 * to a session `course_id` and `valid_until` instant.
 *
 * This is intentionally narrow: it captures the canonical wire format Stage 2 replicates in PHP
 * (`cert-course-key` prefix, UTF‑8 course id, **big-endian** unsigned 64‑bit UNIX seconds).
 *
 * @param courseId - Human-readable UUID or short id as used in enrolment payloads.
 * @param validUntilUnix - Seconds since UNIX epoch; must remain within IEEE-754 safe integers for
 *        this API (`number`) or risk silent rounding before the bigint guard runs.
 * @returns Contiguous Uint8Array `utf8("cert-course-key") ‖ utf8(courseId) ‖ be64(validUntilUnix)`.
 * @throws {RangeError} when the timestamp is not a non‑negative finite integer or does not fit
 *         inside an unsigned 64‑bit scalar (PHP `pack('J', …)` compatibility).
 */

export function buildCertCourseHkdfInfo(courseId: string, validUntilUnix: number): Uint8Array {
  if (!Number.isInteger(validUntilUnix) || validUntilUnix < 0) {
    throw new RangeError("validUntilUnix must be a non-negative integer");
  }
  const n = BigInt(validUntilUnix);
  if (n < 0n || n > 0xffff_ffff_ffff_ffffn) {
    throw new RangeError("validUntilUnix must fit in unsigned 64 bits");
  }
  const courseBytes = new TextEncoder().encode(courseId);
  const out = new Uint8Array(HKDF_SESSION_LABEL.length + courseBytes.length + 8);
  out.set(HKDF_SESSION_LABEL, 0);
  out.set(courseBytes, HKDF_SESSION_LABEL.length);
  const offset = HKDF_SESSION_LABEL.length + courseBytes.length;
  const view = new DataView(out.buffer, out.byteOffset + offset, 8);
  view.setBigUint64(0, n, false);
  return out;
}

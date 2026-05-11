/**
 * Session endorsement canonical message bytes (PHP `Signer::sessionEndorsementMessage`).
 *
 * Concatenates: UTF-8(course_id) ‖ big-endian uint64(validUntilUnix) ‖ K_course_public (32 bytes raw).
 */

/**
 * Builds `course_id ‖ valid_until_be_u64 ‖ K_course_public` (raw).
 *
 * @param courseId - Course identifier (UTF-8 encoded as in PHP string concat).
 * @param validUntilUnix - Seconds since epoch; caller must align with HKDF/session semantics.
 * @param kCoursePublicRaw - 32-byte Ed25519 compressed public key.
 */
export function sessionEndorsementMessage(
  courseId: string,
  validUntilUnix: number,
  kCoursePublicRaw: Uint8Array,
): Uint8Array {
  const enc = new TextEncoder();
  const idBytes = enc.encode(courseId);
  const out = new Uint8Array(idBytes.length + 8 + kCoursePublicRaw.length);
  out.set(idBytes, 0);
  const view = new DataView(out.buffer, out.byteOffset + idBytes.length, 8);
  view.setBigUint64(0, BigInt(validUntilUnix), /* littleEndian */ false);
  out.set(kCoursePublicRaw, idBytes.length + 8);
  return out;
}

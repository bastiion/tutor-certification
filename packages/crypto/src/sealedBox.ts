/**
 * NaCl "sealed boxes" encrypt a message to an **X25519** public key so only the holder of the
 * matching secret key can decrypt. This matches the server's long‑term Curve25519 key used to
 * receive `K_course_private_enc` in the session credential (`K_course_private` transport).
 *
 * This is **not** Ed25519: do not derive these keys by "converting" a signing public key —
 * signing (`K_master` / `K_course`) remains on the Ed25519 curve; sealing uses a separate X25519
 * role ("server box key") as documented in [Concept — Session Credential](../../../../doc/plan/key-signing-courses-plan.md).
 *
 * Requires {@link ../index#ready}.
 */

import sodium from "libsodium-wrappers";
import { assertSodiumReady } from "./assert-sodium.ts";

/**
 * Encrypt `message` anonymously for `recipientPublicKey` (libsodium `crypto_box_seal`).
 *
 * @param message - Plaintext octets (e.g. serialized `K_course_private` seed).
 * @param recipientPublicKey - 32‑byte X25519 public key advertised by the server.
 * @returns Sealed ciphertext (length = message + overhead).
 * @throws {RangeError} if `recipientPublicKey` has wrong length.
 */
export async function boxSeal(message: Uint8Array, recipientPublicKey: Uint8Array): Promise<Uint8Array> {
  assertSodiumReady();
  if (recipientPublicKey.length !== sodium.crypto_box_PUBLICKEYBYTES) {
    throw new RangeError(`sealed-box public key must be ${sodium.crypto_box_PUBLICKEYBYTES} bytes`);
  }
  return sodium.crypto_box_seal(message, recipientPublicKey);
}

/**
 * Decrypt a sealed box with the recipient's X25519 keypair.
 *
 * @param ciphertext - Output of {@link boxSeal}.
 * @param recipientKeypair - X25519 public + secret key (32 bytes each in libsodium layout).
 * @returns Plaintext, or `null` if decryption fails (wrong key, truncated ciphertext, …).
 */
export async function boxSealOpen(
  ciphertext: Uint8Array,
  recipientKeypair: { publicKey: Uint8Array; secretKey: Uint8Array },
): Promise<Uint8Array | null> {
  assertSodiumReady();
  if (recipientKeypair.publicKey.length !== sodium.crypto_box_PUBLICKEYBYTES) {
    throw new RangeError(`sealed-box public key must be ${sodium.crypto_box_PUBLICKEYBYTES} bytes`);
  }
  if (recipientKeypair.secretKey.length !== sodium.crypto_box_SECRETKEYBYTES) {
    throw new RangeError(`sealed-box secret key must be ${sodium.crypto_box_SECRETKEYBYTES} bytes`);
  }
  try {
    return sodium.crypto_box_seal_open(ciphertext, recipientKeypair.publicKey, recipientKeypair.secretKey);
  } catch {
    return null;
  }
}

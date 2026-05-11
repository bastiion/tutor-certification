/**
 * BLAKE2b-256 (libsodium `crypto_generichash`, 32-byte output) of Ed25519 public key, lowercase hex.
 * Mirrors PHP `Signer::masterPublicFingerprintHex`.
 */

import sodium from "libsodium-wrappers";
import { assertSodiumReady } from "./assert-sodium.ts";

/**
 * @param ed25519PublicKey - 32-byte Ed25519 public key.
 * @returns 64-character lowercase hexadecimal string.
 */
export function masterPublicFingerprintHex(ed25519PublicKey: Uint8Array): string {
  assertSodiumReady();
  if (ed25519PublicKey.length !== sodium.crypto_sign_PUBLICKEYBYTES) {
    throw new RangeError(`Ed25519 public key must be ${sodium.crypto_sign_PUBLICKEYBYTES} bytes`);
  }
  const hash = sodium.crypto_generichash(32, ed25519PublicKey);
  return [...hash].map((b) => b.toString(16).padStart(2, "0")).join("");
}

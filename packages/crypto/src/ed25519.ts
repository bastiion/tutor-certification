/**
 * Ed25519 signing helpers for session credentials, certificate payloads, and revocation
 * documents — one algorithm family for both `K_master` and derived `K_course` keys.
 *
 * All functions require {@link ../index#ready} to have completed first.
 */

import sodium from "libsodium-wrappers";
import { assertSodiumReady } from "./assert-sodium.ts";

/** Ed25519 key material in libsodium layout (64‑byte secret = seed ‖ public key). */
export interface Ed25519Keypair {
  /** 32‑byte compressed public key. */
  publicKey: Uint8Array;
  /** 64‑byte NaCl "secret key" (see libsodium `crypto_sign`). */
  secretKey: Uint8Array;
}

/**
 * Derive a signing keypair from a 32‑byte Ed25519 seed (e.g. output of {@link ../hkdf#deriveSessionSeed}).
 *
 * @param seed - Exactly 32 secret octets; must be high‑entropy in production.
 * @returns Public and secret keys suitable for {@link signDetached} / {@link verifyDetached}.
 * @throws {RangeError} if `seed` length is not 32.
 * @example
 * ```ts
 * const { publicKey, secretKey } = await keypairFromSeed(await deriveSessionSeed({ ... }));
 * ```
 * @see [Concept — Signing Algorithm](../../../../doc/plan/key-signing-courses-plan.md)
 * @remarks Never log `seed` or `secretKey`.
 */
export async function keypairFromSeed(seed: Uint8Array): Promise<Ed25519Keypair> {
  assertSodiumReady();
  if (seed.length !== sodium.crypto_sign_SEEDBYTES) {
    throw new RangeError(`Ed25519 seed must be ${sodium.crypto_sign_SEEDBYTES} bytes`);
  }
  const { publicKey, privateKey } = sodium.crypto_sign_seed_keypair(seed);
  return { publicKey, secretKey: privateKey };
}

/**
 * Produce a detached 64‑byte Ed25519 signature over `message`.
 *
 * @param message - Bytes to sign (e.g. canonical JSON bytes, domain‑separated concat, …).
 * @param secretKey - 64‑byte libsodium secret key from {@link keypairFromSeed}.
 * @returns 64‑byte signature (`R ‖ s` layout).
 * @throws {RangeError} if `secretKey` length is wrong.
 * @see [Concept — Session Credential](../../../../doc/plan/key-signing-courses-plan.md)
 */
export async function signDetached(message: Uint8Array, secretKey: Uint8Array): Promise<Uint8Array> {
  assertSodiumReady();
  if (secretKey.length !== sodium.crypto_sign_SECRETKEYBYTES) {
    throw new RangeError(`Ed25519 secretKey must be ${sodium.crypto_sign_SECRETKEYBYTES} bytes`);
  }
  return sodium.crypto_sign_detached(message, secretKey);
}

/**
 * Verify a detached Ed25519 signature.
 *
 * @param signature - 64‑byte detached signature from {@link signDetached}.
 * @param message - Original signed payload bytes.
 * @param publicKey - 32‑byte public key counterpart of the signer.
 * @returns `true` iff the signature verifies; **`false`** for any malformed or invalid proof (never throws for bad signatures).
 * @throws {RangeError} if key or signature lengths are wrong.
 */
export async function verifyDetached(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
): Promise<boolean> {
  assertSodiumReady();
  if (signature.length !== sodium.crypto_sign_BYTES) {
    throw new RangeError(`Ed25519 signature must be ${sodium.crypto_sign_BYTES} bytes`);
  }
  if (publicKey.length !== sodium.crypto_sign_PUBLICKEYBYTES) {
    throw new RangeError(`Ed25519 publicKey must be ${sodium.crypto_sign_PUBLICKEYBYTES} bytes`);
  }
  return sodium.crypto_sign_verify_detached(signature, message, publicKey);
}

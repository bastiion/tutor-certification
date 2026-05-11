/**
 * @bastiion/crypto — shared primitives for Ed25519 signatures, HKDF session derivation, NaCl sealed
 * boxes, and Base64URL helpers used by the tutor, participant, and verify SPAs.
 *
 * Call {@link ready} once early in app startup before any other export.
 */

import sodium from "libsodium-wrappers";
import { setSodiumInitialised } from "./sodium-gate.ts";

export type { Base64Url } from "./crypto-types.ts";

export { base64urlDecode, base64urlEncode } from "./base64url.ts";

export type { HkdfInput } from "./hkdf.ts";

export { deriveSessionSeed } from "./hkdf.ts";

export { sessionEndorsementMessage } from "./sessionMessage.ts";

export { masterPublicFingerprintHex } from "./fingerprint.ts";

export type { Ed25519Keypair } from "./ed25519.ts";

export { keypairFromSeed, signDetached, verifyDetached } from "./ed25519.ts";

export { boxSeal, boxSealOpen } from "./sealedBox.ts";

/** libsodium has finished loading; {@link cryptoPackageStatus} then exposes a version string. */

export interface PackageStatus {
  kind: "ready";
  /** Empty string until {@link ready} has resolved at least once for this JS realm. */
  sodiumVersion: string;
}

let sodiumVersionCache = "";

let readyPromise: Promise<void> | null = null;

/**
 * Initialise libsodium (WASM); safe to `await` multiple times.
 *
 * Must be invoked before {@link base64urlEncode}, Ed25519 helpers, or sealed boxes; {@link deriveSessionSeed}
 * only needs WebCrypto but you should still call `ready` at app startup for a consistent load order.
 */

export async function ready(): Promise<void> {
  if (readyPromise !== null) {
    return readyPromise;
  }
  readyPromise = (async () => {
    await sodium.ready;
    setSodiumInitialised(true);
    sodiumVersionCache =
      typeof sodium.sodium_version_string === "function"
        ? sodium.sodium_version_string()
        : "";
  })();
  return readyPromise;
}

/**
 * Lightweight health probe for UI smoke tests.
 *
 * Never throws. Before {@link ready}, `sodiumVersion` is `""`; afterwards it contains the
 * libsodium semver string (exact format is implementation-defined).
 */

export function cryptoPackageStatus(): PackageStatus {
  return { kind: "ready", sodiumVersion: sodiumVersionCache };
}

/**
 * **Tests only.** Bun runs all spec files in one process; resets libsodium bookkeeping so callers
 * can assert the pre-{@link ready} error surfaces without spawning a subprocess.
 *
 * Not part of the supported public runtime API.
 */

export function __unsafeResetBastiionCryptoPackageStateForTesting(): void {
  readyPromise = null;
  sodiumVersionCache = "";
  setSodiumInitialised(false);
}

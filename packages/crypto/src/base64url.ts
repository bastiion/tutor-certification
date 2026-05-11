/**
 * Helpers for encoding and decoding binary data as URL-safe Base64 **without padding**,
 * matching PHP's `sodium_bin2base64(..., SODIUM_BASE64_VARIANT_URLSAFE_NO_PADDING)`.
 *
 * Requires {@link ../index#ready} to have resolved at least once; otherwise encoding and
 * decoding throw so callers surface a deterministic failure instead of a cryptic WASM error.
 */

import sodium from "libsodium-wrappers";
import type { Base64Url } from "./crypto-types.ts";
import { isSodiumInitialised } from "./sodium-gate.ts";

/** @internal */
export function ensureSodiumForBase64(): void {
  if (!isSodiumInitialised) {
    throw new Error("@ikwsd/crypto: await ready() before using base64url helpers");
  }
}

/** Reject standard-base64 glyphs so wrong-variant strings cannot silently decode wrong. */

function validateUrlSafeNoPaddingAlphabet(input: string): void {
  for (let i = 0; i < input.length; i++) {
    const c = input[i]!;
    if (c === "+" || c === "/") {
      throw new SyntaxError("@ikwsd/crypto: expected URL-safe alphabet (reject + and /)");
    }
    if (c === "=") {
      throw new SyntaxError("@ikwsd/crypto: padding is not permitted (URL-safe unpadded)");
    }
  }
}

/**
 * Encodes bytes as URL-safe Base64 without `=` padding.
 *
 * Call {@link ../index#ready} first — this wraps libsodium `to_base64` with
 * {@link sodium.base64_variants.URLSAFE_NO_PADDING}.
 *
 * @param bytes - Arbitrary-length byte slice to encode.
 * @returns A branded URL-safe Base64 string (no padding).
 * @throws {Error} if libsodium has not been initialised via {@link ../index#ready}.
 * @example
 * ```ts
 * await ready();
 * const out = base64urlEncode(new Uint8Array([102])); // "Zg"
 * ```
 * @see [Concept — Session Credential](../../../../doc/plan/key-signing-courses-plan.md) (fields like `session_sig`)
 * @remarks Do not log secrets; even encoded values often reveal plaintext length.
 */
export function base64urlEncode(bytes: Uint8Array): Base64Url {
  ensureSodiumForBase64();
  const encoded = sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
  return encoded as Base64Url;
}

/**
 * Decodes a URL-safe unpadded Base64 string into raw bytes.
 *
 * @param value - Candidate Base64 URL-safe string (`-`/`_`, no padding).
 * @returns Decoded octets as a newly allocated {@link Uint8Array}.
 * @throws {SyntaxError} on non‑URL‑safe alphabet (including standard `+/`) or padded input.
 * @throws {Error} if libsodium has not been initialised via {@link ../index#ready}.
 * @example
 * ```ts
 * await ready();
 * const bytes = base64urlDecode("Zg9v"); // "foo"
 * ```
 * @see [Concept — Session Credential](../../../../doc/plan/key-signing-courses-plan.md)
 */
export function base64urlDecode(value: string): Uint8Array {
  ensureSodiumForBase64();
  validateUrlSafeNoPaddingAlphabet(value);
  return sodium.from_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);
}

/** Ed25519 detached signatures. */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "bun:test";

import { base64urlDecode } from "./base64url.ts";
import type { Base64Url } from "./crypto-types.ts";
import { keypairFromSeed, signDetached, verifyDetached } from "./ed25519.ts";
import { ready } from "./index.ts";

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

interface EdVector {
  seed_b64: string;
  message_b64: string;
  expected_pk_b64: string;
  expected_signature_b64: string;
}

describe("ed25519", () => {
  it("RFC 8032 vector (empty message)", async () => {
    await ready();
    const p = path.join(import.meta.dir, "..", "test-vectors", "ed25519-rfc8032-001.json");
    const v = JSON.parse(readFileSync(p, "utf8")) as EdVector;
    const seed = base64urlDecode(v.seed_b64 as Base64Url);
    const message = base64urlDecode(v.message_b64 as Base64Url);
    const expectedPk = base64urlDecode(v.expected_pk_b64 as Base64Url);
    const expectedSig = base64urlDecode(v.expected_signature_b64 as Base64Url);
    const kp = await keypairFromSeed(seed);
    expect(equalBytes(kp.publicKey, expectedPk)).toBe(true);
    const sig = await signDetached(message, kp.secretKey);
    expect(equalBytes(sig, expectedSig)).toBe(true);
    expect(await verifyDetached(expectedSig, message, expectedPk)).toBe(true);
  });

  it("random message sign/verify and bit flip", async () => {
    await ready();
    const seed = crypto.getRandomValues(new Uint8Array(32));
    const kp = await keypairFromSeed(seed);
    const msg = crypto.getRandomValues(new Uint8Array(64));
    const sig = await signDetached(msg, kp.secretKey);
    expect(await verifyDetached(sig, msg, kp.publicKey)).toBe(true);
    const flipped = Uint8Array.from(sig);
    flipped[0] = (flipped[0] ?? 0) ^ 1;
    expect(await verifyDetached(flipped, msg, kp.publicKey)).toBe(false);
  });

  it("deterministic signatures", async () => {
    await ready();
    const seed = new Uint8Array(32).fill(9);
    const kp = await keypairFromSeed(seed);
    const msg = new TextEncoder().encode("hello-ed25519");
    const s1 = await signDetached(msg, kp.secretKey);
    const s2 = await signDetached(msg, kp.secretKey);
    expect(equalBytes(s1, s2)).toBe(true);
  });

  it("reject wrong-length material", async () => {
    await ready();
    const kp = await keypairFromSeed(new Uint8Array(32));
    await expect(keypairFromSeed(new Uint8Array(31))).rejects.toThrow(RangeError);
    await expect(signDetached(new Uint8Array(), new Uint8Array(63))).rejects.toThrow(RangeError);
    await expect(verifyDetached(kp.secretKey, new Uint8Array(), kp.publicKey)).resolves.toBe(false);
    await expect(verifyDetached(new Uint8Array(63), new Uint8Array(), kp.publicKey)).rejects.toThrow(RangeError);
    await expect(verifyDetached(new Uint8Array(64), new Uint8Array(), kp.publicKey.subarray(0, 31))).rejects.toThrow(
      RangeError,
    );
  });
});

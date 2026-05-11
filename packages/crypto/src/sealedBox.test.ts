/** Sealed NaCl crypto_box_seal (X25519). */

import sodium from "libsodium-wrappers";

import { describe, expect, it } from "bun:test";

import { assertSodiumReady } from "./assert-sodium.ts";
import { boxSeal, boxSealOpen } from "./sealedBox.ts";
import {
  base64urlDecode,
  cryptoPackageStatus,
  __unsafeResetBastiionCryptoPackageStateForTesting,
  ready,
} from "./index.ts";

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

describe("boxSeal", () => {
  it("rejects malformed key lengths early", async () => {
    await ready();
    const short = new Uint8Array(10);
    await expect(boxSeal(new Uint8Array([1]), short)).rejects.toThrow(/32/);
    const { publicKey, privateKey } = sodium.crypto_box_keypair();
    await expect(boxSealOpen(new Uint8Array([9]), { publicKey: short, secretKey: privateKey })).rejects.toThrow(
      RangeError,
    );
    await expect(boxSealOpen(new Uint8Array([9]), { publicKey, secretKey: short })).rejects.toThrow(RangeError);
  });

  it("round-trips plaintext", async () => {
    await ready();
    const { publicKey, privateKey } = sodium.crypto_box_keypair();
    const kp = { publicKey, secretKey: privateKey };
    const plaintext = crypto.getRandomValues(new Uint8Array(500));
    const ct = await boxSeal(plaintext, publicKey);
    const opened = await boxSealOpen(ct, kp);
    expect(opened).not.toBeNull();
    expect(equalBytes(opened!, plaintext)).toBe(true);
  });

  it("returns null when opening with wrong recipient pair", async () => {
    await ready();
    const alice = sodium.crypto_box_keypair();
    const bob = sodium.crypto_box_keypair();
    const ciphertext = await boxSeal(new Uint8Array([1, 2, 3]), alice.publicKey);
    const opened = await boxSealOpen(ciphertext, { publicKey: bob.publicKey, secretKey: bob.privateKey });
    expect(opened).toBeNull();
  });

  it("returns null for truncated ciphertext", async () => {
    await ready();
    const { publicKey, privateKey } = sodium.crypto_box_keypair();
    const opened = await boxSealOpen(new Uint8Array([0]), {
      publicKey,
      secretKey: privateKey,
    });
    expect(opened).toBeNull();
  });

  describe("post-suite cold-start regression", () => {
    it("rejects base64/helpers until libsodium is initialised again", async () => {
      __unsafeResetBastiionCryptoPackageStateForTesting();
      expect(cryptoPackageStatus().sodiumVersion).toBe("");
      expect(() => assertSodiumReady()).toThrow(/ready/);
      expect(() => base64urlDecode("Zg")).toThrow(/await ready/);
      await ready();
      expect(() => assertSodiumReady()).not.toThrow();
      expect(base64urlDecode("Zg")).toEqual(new Uint8Array([102]));
    });
  });
});

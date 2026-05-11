import { describe, expect, test } from "bun:test";
import sodium from "libsodium-wrappers";
import { masterPublicFingerprintHex } from "./fingerprint.ts";
import { ready, __unsafeResetBastiionCryptoPackageStateForTesting } from "./index.ts";

describe("masterPublicFingerprintHex", () => {
  test("matches libsodium.crypto_generichash(32, pk) hex", async () => {
    await ready();
    const pk = new Uint8Array(32);
    pk[0] = 1;
    pk[31] = 255;

    const h = sodium.crypto_generichash(32, pk);
    const expected = [...h].map((b) => b.toString(16).padStart(2, "0")).join("");

    expect(masterPublicFingerprintHex(pk)).toBe(expected);

    __unsafeResetBastiionCryptoPackageStateForTesting();
  });

  test("wrong length throws", async () => {
    await ready();
    expect(() => masterPublicFingerprintHex(new Uint8Array(31))).toThrow(RangeError);
    __unsafeResetBastiionCryptoPackageStateForTesting();
  });

  test("requires ready()", () => {
    __unsafeResetBastiionCryptoPackageStateForTesting();
    expect(() => masterPublicFingerprintHex(new Uint8Array(32))).toThrow(/await ready/i);
  });
});

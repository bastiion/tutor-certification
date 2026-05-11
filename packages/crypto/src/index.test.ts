/** Package bootstrap probe. */

import { describe, expect, it } from "bun:test";

import { cryptoPackageStatus, ready } from "./index.ts";

describe("@ikwsd/crypto package status", () => {
  it("never throws synchronously before or after libsodium bootstrap", async () => {
    expect(() => cryptoPackageStatus()).not.toThrow();
    await ready();
    expect(() => cryptoPackageStatus()).not.toThrow();
  });

  it("reports non-empty libsodium semver after ready", async () => {
    await ready();
    const status = cryptoPackageStatus();
    expect(status.kind).toBe("ready");
    expect(typeof status.sodiumVersion).toBe("string");
    expect(status.sodiumVersion.length).toBeGreaterThan(0);
  });

  it("await ready twice is benign", async () => {
    await ready();
    await ready();
    expect(cryptoPackageStatus().sodiumVersion.length).toBeGreaterThan(0);
  });
});

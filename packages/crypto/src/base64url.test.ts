/** Base64 URL-safe helpers (libsodium wrappers). */

import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "bun:test";

import { base64urlDecode, base64urlEncode } from "./base64url.ts";
import type { Base64Url } from "./crypto-types.ts";
import { ready } from "./index.ts";

describe("base64url", () => {
  const enc = new TextEncoder();

  it("round-trips random bytes (256 buffers)", async () => {
    await ready();
    for (let round = 0; round < 256; round++) {
      const len = round % 128;
      const buf = crypto.getRandomValues(new Uint8Array(len));
      const b64 = base64urlEncode(buf);
      expect(base64urlDecode(b64)).toEqual(buf);
    }
  });

  it("RFC 4648–style URL-safe snapshots", async () => {
    await ready();
    interface FixtureRoot {
      round_trips_utf8_to_b64url: { utf8: string; expected_b64url: string }[];
    }
    const p = path.join(import.meta.dir, "..", "test-vectors", "base64url-rfc4648.json");
    const data = JSON.parse(readFileSync(p, "utf8")) as FixtureRoot;
    for (const row of data.round_trips_utf8_to_b64url) {
      const bytes = enc.encode(row.utf8);
      expect(base64urlEncode(bytes) as Base64Url).toBe(row.expected_b64url as Base64Url);
      if (row.expected_b64url.length > 0) {
        expect(base64urlDecode(row.expected_b64url)).toEqual(bytes);
      }
    }
  });

  it("reject padded input", async () => {
    await ready();
    expect(() => base64urlDecode("AAAA=")).toThrow(/padding/i);
  });

  it("reject standard base64 alphabet", async () => {
    await ready();
    expect(() => base64urlDecode("Zm9+vL8")).toThrow(/URL-safe alphabet/); // "+" branch
    expect(() => base64urlDecode("Zm9-/vL8")).toThrow(/URL-safe alphabet/); // "/" branch
    expect(() => base64urlDecode("Ym9vbis=")).toThrow();
  });

  it("encode result is assignable to Base64Url brand", async () => {
    await ready();
    const x: Base64Url = base64urlEncode(new Uint8Array([1, 2, 3]));
    expect(x.length).toBeGreaterThan(0);
  });
});

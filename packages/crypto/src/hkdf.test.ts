/**
 * Bun unit tests — {@link deriveSessionSeed} vs RFC 5869 reference implementation.
 */

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "bun:test";

import { base64urlDecode } from "./base64url.ts";
import type { Base64Url } from "./crypto-types.ts";
import { buildCertCourseHkdfInfo } from "./hkdf-info.ts";
import { deriveSessionSeed } from "./hkdf.ts";
import { ready } from "./index.ts";

async function hmacSha256(key: Uint8Array, msg: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, msg);
  return new Uint8Array(sig);
}

/**
 * RFC5869 HKDF-SHA256. Empty salt substitutes HashLen zeros (WebCrypto-compatible).
 */
async function hkdfSha256(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const hashLen = 32;
  const saltSubstitute = salt.length === 0 ? new Uint8Array(hashLen) : salt;
  const prk = await hmacSha256(saltSubstitute, ikm);

  const chunks: Uint8Array[] = [];
  let tPrev = new Uint8Array(0);
  let counter = 1;
  while (chunks.reduce((a, c) => a + c.length, 0) < length) {
    const concat = new Uint8Array(tPrev.length + info.length + 1);
    concat.set(tPrev);
    concat.set(info, tPrev.length);
    concat[concat.length - 1] = counter++;
    const next = await hmacSha256(prk, concat);
    tPrev = new Uint8Array(next);
    chunks.push(new Uint8Array(tPrev));
  }
  const okmJoined = concatUintArrays(chunks);
  return okmJoined.slice(0, length);
}

function concatUintArrays(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

interface HkdfVector {
  ikm_b64: string;
  course_id: string;
  valid_until_unix: number;
  expected_okm_b64: string;
}

describe("buildCertCourseHkdfInfo", () => {
  it("throws on unusable timestamps", () => {
    expect(() => buildCertCourseHkdfInfo("id", NaN)).toThrow(/non-negative integer/);
    expect(() => buildCertCourseHkdfInfo("id", 1.2)).toThrow(/non-negative integer/);
    expect(() => buildCertCourseHkdfInfo("id", -1)).toThrow(/non-negative integer/);
    expect(() => buildCertCourseHkdfInfo("id", Number.POSITIVE_INFINITY)).toThrow();
  });

  it("throws when coercion exceeds unsigned 64-bit bound", () => {
    /** Binary64 approximation that widens beyond `2**64-1` once converted to bigint. */
    expect(() => buildCertCourseHkdfInfo("id", 38346744073709552000)).toThrow(/unsigned 64/);
  });

});

describe("deriveSessionSeed", () => {
  it("loads committed vectors byte-for-byte", async () => {
    await ready();
    const vectorsDir = path.join(import.meta.dir, "..", "test-vectors");
    const paths = readdirSync(vectorsDir).filter((f) => /^hkdf-cert-course-key-\d+\.json$/.test(f));
    for (const fname of paths) {
      const v = JSON.parse(readFileSync(path.join(vectorsDir, fname), "utf8")) as HkdfVector;
      const ikm = base64urlDecode(v.ikm_b64 as Base64Url);
      const expected = base64urlDecode(v.expected_okm_b64 as Base64Url);
      const got = await deriveSessionSeed({
        ikm,
        courseId: v.course_id,
        validUntilUnix: v.valid_until_unix,
      });
      expect(equalBytes(got, expected)).toBe(true);
    }
  });

  it("matches cross-implementation manual HKDF (RFC 5869 expand)", async () => {
    await ready();
    const vectorsDir = path.join(import.meta.dir, "..", "test-vectors");
    const fname = "hkdf-cert-course-key-001.json";
    const v = JSON.parse(readFileSync(path.join(vectorsDir, fname), "utf8")) as HkdfVector;
    const ikm = base64urlDecode(v.ikm_b64 as Base64Url);
    const info = buildCertCourseHkdfInfo(v.course_id, v.valid_until_unix);
    const web = await deriveSessionSeed({
      ikm,
      courseId: v.course_id,
      validUntilUnix: v.valid_until_unix,
    });
    const hand = await hkdfSha256(ikm, new Uint8Array(0), info, 32);
    expect(equalBytes(web, hand)).toBe(true);
  });

  it("is deterministic across two calls", async () => {
    await ready();
    const inputs = {
      ikm: new Uint8Array(32).fill(7),
      courseId: "x",
      validUntilUnix: 12_345,
    };
    const a = await deriveSessionSeed(inputs);
    const b = await deriveSessionSeed(inputs);
    expect(equalBytes(a, b)).toBe(true);
  });

  it("sensitive to course id and expiry", async () => {
    await ready();
    const inputs = {
      ikm: new Uint8Array(32).fill(7),
      courseId: "course-a",
      validUntilUnix: 1000,
    };
    const base = await deriveSessionSeed(inputs);
    const tweakedCourse = await deriveSessionSeed({ ...inputs, courseId: "course-b" });
    const tweakedExpiry = await deriveSessionSeed({ ...inputs, validUntilUnix: 1001 });
    expect(equalBytes(base, tweakedCourse)).toBe(false);
    expect(equalBytes(base, tweakedExpiry)).toBe(false);
  });

  it("rejects unsupported length", async () => {
    await ready();
    const bad = {
      ikm: new Uint8Array(32),
      courseId: "c",
      validUntilUnix: 0,
      length: 16,
    } as unknown as import("./hkdf.ts").HkdfInput;
    await expect(deriveSessionSeed(bad)).rejects.toThrow("only length 32");
  });
});

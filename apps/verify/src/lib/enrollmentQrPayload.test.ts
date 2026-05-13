import { describe, expect, test } from "bun:test";
import { base64urlEncode } from "@bastiion/crypto";
import {
  coerceVerifyClipboardOrQrText,
  rawCertificateJsonFromQrPayload,
  stripQrUrlPrefix,
} from "./enrollmentQrPayload.ts";

describe("stripQrUrlPrefix", () => {
  test("passes through raw Base64URL (legacy QR)", () => {
    const inner = base64urlEncode(new TextEncoder().encode("{}"));
    expect(stripQrUrlPrefix(inner)).toBe(inner);
    expect(stripQrUrlPrefix(`  ${inner} \n`)).toBe(inner);
  });

  test("extracts fragment from https URL (#cert=payload)", () => {
    const inner = base64urlEncode(new TextEncoder().encode('{"cert_id":"x"}'));
    const url = `https://example.org/verify/#cert=${encodeURIComponent(inner)}`;
    expect(stripQrUrlPrefix(url)).toBe(inner);
  });

  test("accepts uppercase HTTP scheme spelling", () => {
    const inner = base64urlEncode(new TextEncoder().encode("{}"));
    const url = `HTTP://LOCALHOST:7123/VERIFY/PATH/#cert=${encodeURIComponent(inner)}`;
    expect(stripQrUrlPrefix(url)).toBe(inner);
  });

  test("accepts #cert=payload snippet without scheme", () => {
    const inner = base64urlEncode(new TextEncoder().encode("{}"));
    expect(stripQrUrlPrefix(` #cert=${encodeURIComponent(inner)} `)).toBe(inner);
  });

  test("throws on missing fragment for http URL", () => {
    expect(() => stripQrUrlPrefix("https://example.org/verify/")).toThrow(/#cert=/);
  });

  test("throws on empty input", () => {
    expect(() => stripQrUrlPrefix("")).toThrow(/Leerer/);
  });

  test("throws when #cert value empty", () => {
    expect(() => stripQrUrlPrefix("https://a/b#cert=")).toThrow();
  });
});

describe("rawCertificateJsonFromQrPayload", () => {
  test("inverts Stage-4 enrollment QR encoding", () => {
    const raw = JSON.stringify({ cert_id: "11111111-1111-4111-8111-111111111111", x: 1 });
    const payload = base64urlEncode(new TextEncoder().encode(raw));
    expect(rawCertificateJsonFromQrPayload(payload)).toBe(raw);
  });

  test("inverts Stage-6b URL-wrapped encoding", () => {
    const raw = JSON.stringify({ cert_id: "11111111-1111-4111-8111-111111111111" });
    const payload = base64urlEncode(new TextEncoder().encode(raw));
    const url = `http://localhost:7123/verify/#cert=${payload}`;
    expect(rawCertificateJsonFromQrPayload(url)).toBe(raw);
  });
});

describe("coerceVerifyClipboardOrQrText", () => {
  test("returns JSON paste untouched", () => {
    const j = '{"cert_id":"x"}';
    expect(coerceVerifyClipboardOrQrText(j)).toBe(j);
    expect(coerceVerifyClipboardOrQrText(` ${j}`)).toBe(` ${j}`);
  });

  test("decodes QR / URL payloads", () => {
    const raw = JSON.stringify({ cert_id: "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee" });
    const inner = base64urlEncode(new TextEncoder().encode(raw));
    expect(coerceVerifyClipboardOrQrText(inner)).toBe(raw);
    expect(coerceVerifyClipboardOrQrText(`http://localhost/verify/#cert=${inner}`)).toBe(raw);
  });
});

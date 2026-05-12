import { describe, expect, test } from "bun:test";
import { base64urlEncode } from "@bastiion/crypto";
import { rawCertificateJsonFromQrPayload } from "./enrollmentQrPayload.ts";

describe("rawCertificateJsonFromQrPayload", () => {
  test("inverts Stage-4 enrollment QR encoding", () => {
    const raw = JSON.stringify({ cert_id: "11111111-1111-4111-8111-111111111111", x: 1 });
    const payload = base64urlEncode(new TextEncoder().encode(raw));
    expect(rawCertificateJsonFromQrPayload(payload)).toBe(raw);
  });
});

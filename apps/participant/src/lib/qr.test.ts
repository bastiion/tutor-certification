import { describe, expect, test } from "bun:test";
import { base64urlDecode } from "@bastiion/crypto";
import {
  rawCertificateJsonFromQrPayload,
  stripQrUrlPrefix,
} from "../../../verify/src/lib/enrollmentQrPayload.ts";
import { enrollmentQrPayloadFromRawBody, qrCodeSvgForPayload, qrUrlForCertResponse } from "./qr.ts";

describe("enrollment QR", () => {
  test("payload is base64url without padding of raw UTF-8 body", () => {
    const raw = '{"cert_id":"x","participant":{"name":"ü"}}';
    const payload = enrollmentQrPayloadFromRawBody(raw);
    expect(payload).not.toContain("+");
    expect(payload).not.toContain("/");
    expect(payload).not.toContain("=");
    const round = new TextDecoder().decode(base64urlDecode(payload));
    expect(round).toBe(raw);
  });

  test("svg output contains QR drawing primitives", async () => {
    const payload = enrollmentQrPayloadFromRawBody("x".repeat(400));
    const svg = await qrCodeSvgForPayload(payload);
    expect(svg.includes("<svg")).toBe(true);
    expect(svg.includes("</svg>")).toBe(true);
    expect(svg.length > 800).toBe(true);
  });

  test("qrUrlForCertResponse round-trips via stripQrUrlPrefix + decoder", () => {
    const raw = JSON.stringify({
      cert_id: "aaaaaaaa-bbbb-4ccc-dddd-eeeeeeeeeeee",
      participant: { name: "Test" },
    });
    const base = "https://certs.example.org/verify/";
    const url = qrUrlForCertResponse(raw, base);
    expect(url).toContain("#cert=");
    const inner = stripQrUrlPrefix(url);
    expect(inner).toBe(enrollmentQrPayloadFromRawBody(raw));
    expect(rawCertificateJsonFromQrPayload(url)).toBe(raw);
  });
});

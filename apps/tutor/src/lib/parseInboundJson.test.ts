import { describe, expect, test } from "bun:test";
import { parseInboundJson } from "./parseInboundJson.ts";
import { certificateWireSchema } from "@bastiion/verify/src/lib/certificateSchema.ts";

function minimalRaw(): string {
  const c = certificateWireSchema.parse({
    cert_id: "11111111-1111-4111-8111-111111111111",
    version: 1,
    issued_at: "2026-05-11T12:00:00.000Z",
    course: { id: "22222222-2222-4222-8222-222222222222", title: "K", date: "2026-05-11" },
    participant: { name: "A" },
    institute: { name: "I", key_fingerprint: "a".repeat(64) },
    K_master_public: "x",
    K_course_public: "y",
    session_sig: "s",
    valid_until: 2_000_000_000,
    certificate_sig: "t",
  });
  return JSON.stringify(c);
}

describe("parseInboundJson", () => {
  test("accepts fixture", () => {
    const raw = minimalRaw();
    const r = parseInboundJson(raw);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.certificate.cert_id).toBe("11111111-1111-4111-8111-111111111111");
    }
  });

  test("rejects malformed JSON string", () => {
    const r = parseInboundJson("{");
    expect(r.ok).toBe(false);
  });

  test("rejects non-certificate object", () => {
    const r = parseInboundJson("{}");
    expect(r.ok).toBe(false);
  });

  test("dedupe semantics live in auditStore; repeated import same raw succeeds parse", () => {
    const raw = minimalRaw();
    expect(parseInboundJson(raw).ok).toBe(true);
    expect(parseInboundJson(raw).ok).toBe(true);
  });
});

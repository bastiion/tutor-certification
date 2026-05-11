import { describe, expect, test } from "bun:test";
import { certificateWireSchema, revocationDocSchema } from "./certificateSchema.ts";

describe("certificateWireSchema", () => {
  const minimal = {
    cert_id: "00000000-0000-4000-8000-000000000001",
    version: 1 as const,
    issued_at: "2026-05-11T12:00:00+00:00",
    course: { id: "c1", title: "T", date: "2026-05-11" },
    participant: { name: "N" },
    institute: { name: "I", key_fingerprint: "f" },
    K_master_public: "a",
    K_course_public: "b",
    session_sig: "s",
    valid_until: 999,
    certificate_sig: "z",
  };

  test("accepts the Stage 4 / API wire shape", () => {
    const r = certificateWireSchema.safeParse(minimal);
    expect(r.success).toBe(true);
  });

  test("rejects extra top-level keys", () => {
    const r = certificateWireSchema.safeParse({ ...minimal, extra: 1 });
    expect(r.success).toBe(false);
  });

  test("rejects wrong version", () => {
    const r = certificateWireSchema.safeParse({ ...minimal, version: 2 });
    expect(r.success).toBe(false);
  });

  test("rejects invalid uuid", () => {
    const r = certificateWireSchema.safeParse({ ...minimal, cert_id: "not-a-uuid" });
    expect(r.success).toBe(false);
  });

  test("allows optional participant email", () => {
    const r = certificateWireSchema.safeParse({ ...minimal, participant: { name: "N", email: "a@b.c" } });
    expect(r.success).toBe(true);
  });
});

describe("revocationDocSchema", () => {
  test("accepts revocation payload", () => {
    const r = revocationDocSchema.safeParse({
      cert_id: "00000000-0000-4000-8000-000000000001",
      revoked_at: "2026-05-11T12:00:00.000Z",
      reason: "r",
      signature: "sig",
    });
    expect(r.success).toBe(true);
  });

  test("rejects extra keys", () => {
    const r = revocationDocSchema.safeParse({
      cert_id: "00000000-0000-4000-8000-000000000001",
      revoked_at: "2026-05-11T12:00:00.000Z",
      reason: "r",
      signature: "sig",
      x: 1,
    });
    expect(r.success).toBe(false);
  });
});

import { describe, expect, test } from "bun:test";
import {
  emptyAuditState,
  exportAuditState,
  importAuditState,
  markRevoked,
  sortedRows,
  upsertCertificate,
} from "./auditStore.ts";
import { certificateWireSchema } from "@bastiion/verify/src/lib/certificateSchema.ts";

function minimalCert(overrides: Partial<Record<string, unknown>> = {}): {
  cert: ReturnType<typeof certificateWireSchema.parse>;
  raw: string;
} {
  const base = {
    cert_id: "11111111-1111-4111-8111-111111111111",
    version: 1,
    issued_at: "2026-05-11T12:00:00.000Z",
    course: { id: "22222222-2222-4222-8222-222222222222", title: "Kurs A", date: "2026-05-11" },
    participant: { name: "Erika Musterfrau" },
    institute: { name: "Institut", key_fingerprint: "a".repeat(64) },
    K_master_public: "QQ",
    K_course_public: "RR",
    session_sig: "SS",
    valid_until: 2_000_000_000,
    certificate_sig: "TT",
    ...overrides,
  };
  const cert = certificateWireSchema.parse(base);
  const raw = JSON.stringify(cert);
  return { cert, raw };
}

describe("auditStore", () => {
  test("upsert + sortedRows issued_desc", () => {
    let s = emptyAuditState();
    const a = minimalCert({ cert_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", issued_at: "2026-01-01T00:00:00.000Z" });
    const b = minimalCert({ cert_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", issued_at: "2026-06-01T00:00:00.000Z" });
    s = upsertCertificate(s, a.raw, a.cert);
    s = upsertCertificate(s, b.raw, b.cert);
    const ord = sortedRows(s, "issued_desc").map((r) => r.certId);
    expect(ord[0]).toBe(b.cert.cert_id);
  });

  test("markRevoked + export + import round-trip", () => {
    let s = emptyAuditState();
    const { cert, raw } = minimalCert();
    s = upsertCertificate(s, raw, cert);
    s = markRevoked(s, cert.cert_id, "2026-05-12T00:00:00.000Z", "Testgrund");
    const json = exportAuditState(s);
    const s2 = importAuditState(json);
    expect(s2.rowsByCertId.size).toBe(1);
    const row = s2.rowsByCertId.get(cert.cert_id);
    expect(row?.revoked).toBe(true);
    expect(row?.revocationReason).toBe("Testgrund");
  });

  test("import rejects bad JSON", () => {
    expect(() => importAuditState("not json")).toThrow("kein gültiges JSON");
  });

  test("import rejects wrong version", () => {
    expect(() => importAuditState("{}")).toThrow("unerwartetes Format");
  });

  test("import rejects missing rows", () => {
    expect(() => importAuditState(JSON.stringify({ version: 1 }))).toThrow("rows fehlen");
  });
});

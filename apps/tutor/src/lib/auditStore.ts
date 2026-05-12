import type { CertificateWire } from "@bastiion/verify/src/lib/certificateSchema.ts";
import { parseInboundJson } from "./parseInboundJson.ts";

export interface AuditRow {
  readonly certId: string;
  /** Original JSON string as imported (for export round-trip). */
  readonly rawJson: string;
  readonly certificate: CertificateWire;
  revoked: boolean;
  revokedAt?: string;
  revocationReason?: string;
}

export interface AuditExportV1 {
  readonly version: 1;
  readonly rows: readonly AuditRowExport[];
}

export interface AuditRowExport {
  readonly rawJson: string;
  readonly revoked: boolean;
  readonly revokedAt?: string;
  readonly revocationReason?: string;
}

export interface AuditState {
  readonly rowsByCertId: Map<string, AuditRow>;
}

export function emptyAuditState(): AuditState {
  return { rowsByCertId: new Map() };
}

export function upsertCertificate(state: AuditState, rawJson: string, certificate: CertificateWire): AuditState {
  const next = new Map(state.rowsByCertId);
  const existing = next.get(certificate.cert_id);
  next.set(certificate.cert_id, {
    certId: certificate.cert_id,
    rawJson,
    certificate,
    revoked: existing?.revoked ?? false,
    revokedAt: existing?.revokedAt,
    revocationReason: existing?.revocationReason,
  });
  return { rowsByCertId: next };
}

export function markRevoked(
  state: AuditState,
  certId: string,
  revokedAt: string,
  reason: string,
): AuditState {
  const next = new Map(state.rowsByCertId);
  const row = next.get(certId);
  if (row === undefined) return state;
  next.set(certId, {
    ...row,
    revoked: true,
    revokedAt,
    revocationReason: reason,
  });
  return { rowsByCertId: next };
}

export function exportAuditState(state: AuditState): string {
  const rows: AuditRowExport[] = [...state.rowsByCertId.values()].map((r) => ({
    rawJson: r.rawJson,
    revoked: r.revoked,
    revokedAt: r.revokedAt,
    revocationReason: r.revocationReason,
  }));
  const doc: AuditExportV1 = { version: 1, rows };
  return JSON.stringify(doc, null, 2);
}

export function importAuditState(json: string): AuditState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Export-Datei: kein gültiges JSON.");
  }
  if (typeof parsed !== "object" || parsed === null || (parsed as { version?: unknown }).version !== 1) {
    throw new Error("Export-Datei: unerwartetes Format.");
  }
  const rows = (parsed as { rows?: unknown }).rows;
  if (!Array.isArray(rows)) {
    throw new Error("Export-Datei: rows fehlen.");
  }
  let acc = emptyAuditState();
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const rawJson = (row as { rawJson?: unknown }).rawJson;
    if (typeof rawJson !== "string") continue;
    const p = parseInboundJson(rawJson);
    if (!p.ok) continue;
    const revoked = Boolean((row as { revoked?: unknown }).revoked);
    const revokedAt = (row as { revokedAt?: unknown }).revokedAt;
    const revocationReason = (row as { revocationReason?: unknown }).revocationReason;
    acc = upsertCertificate(acc, p.raw, p.certificate);
    if (revoked && typeof revokedAt === "string" && typeof revocationReason === "string") {
      acc = markRevoked(acc, p.certificate.cert_id, revokedAt, revocationReason);
    }
  }
  return acc;
}

export function sortedRows(state: AuditState, order: "issued_desc" | "issued_asc"): AuditRow[] {
  const list = [...state.rowsByCertId.values()];
  const mul = order === "issued_desc" ? -1 : 1;
  list.sort((a, b) => {
    const at = a.certificate.issued_at;
    const bt = b.certificate.issued_at;
    if (at < bt) return -1 * mul;
    if (at > bt) return 1 * mul;
    return a.certId.localeCompare(b.certId);
  });
  return list;
}

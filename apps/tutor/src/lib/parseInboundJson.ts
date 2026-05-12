import { certificateWireSchema, type CertificateWire } from "@bastiion/verify/src/lib/certificateSchema.ts";

export type ParseInboundJsonOk = { ok: true; certificate: CertificateWire; raw: string };
export type ParseInboundJsonErr = { ok: false; error: string };

export function parseInboundJson(raw: string): ParseInboundJsonOk | ParseInboundJsonErr {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Ungültiges JSON." };
  }
  const decoded = certificateWireSchema.safeParse(parsed);
  if (!decoded.success) {
    return { ok: false, error: "Kein gültiges Bescheinigungs-JSON." };
  }
  return { ok: true, certificate: decoded.data, raw };
}

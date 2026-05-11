import type { RevocationDocWire } from "./certificateSchema.ts";
import { revocationDocSchema } from "./certificateSchema.ts";

export type VerifyEndpointResult =
  /** 200 with revocation payload */
  | { kind: "revoked"; revocationDoc: RevocationDocWire }
  /** 200, no revocation on file */
  | { kind: "ok_no_revocation" }
  /** Malformed cert id (server) */
  | { kind: "not_found" }
  /** Transport / non-2xx except 404 */
  | { kind: "network_error" }
  /** 5xx / other HTTP failure */
  | { kind: "http_error"; status: number };

function joinBaseAndPath(apiBaseUrl: string, certId: string): string {
  const path = `/api/verify/${encodeURIComponent(certId)}`;
  const base = apiBaseUrl.replace(/\/+$/, "");
  if (base === "") {
    return path;
  }
  return `${base}${path}`;
}

/**
 * GET /api/verify/{certId} — same-origin when {@param apiBaseUrl} is empty.
 */
export async function fetchVerifyStatus(
  apiBaseUrl: string,
  certId: string,
  fetchImpl: typeof fetch,
): Promise<VerifyEndpointResult> {
  const url = joinBaseAndPath(apiBaseUrl, certId);
  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: { Accept: "application/json" },
      method: "GET",
    });
  } catch {
    return { kind: "network_error" };
  }

  if (res.status === 404) {
    return { kind: "not_found" };
  }

  if (!res.ok) {
    return { kind: "http_error", status: res.status };
  }

  let body: unknown;
  try {
    body = (await res.json()) as unknown;
  } catch {
    return { kind: "http_error", status: res.status };
  }

  if (typeof body !== "object" || body === null || !("valid" in body)) {
    return { kind: "http_error", status: res.status };
  }

  const valid = (body as { valid?: unknown }).valid;
  if (valid === true) {
    return { kind: "ok_no_revocation" };
  }

  if (valid === false) {
    const rawDoc = (body as { revocation_doc?: unknown }).revocation_doc;
    const parsed = revocationDocSchema.safeParse(rawDoc);
    if (!parsed.success) {
      return { kind: "http_error", status: res.status };
    }
    return { kind: "revoked", revocationDoc: parsed.data };
  }

  return { kind: "http_error", status: res.status };
}

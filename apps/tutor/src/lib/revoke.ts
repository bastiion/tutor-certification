import { base64urlEncode, keypairFromSeed, ready, signDetached } from "@bastiion/crypto";

export type PostRevocationResult =
  | { ok: true; status: 200 | 409 }
  | { ok: false; status: number; message: string };

export interface PostRevocationInput {
  apiBaseUrl: string;
  bearerToken: string;
  certId: string;
  revokedAt: string;
  reason: string;
  kMasterSeed32: Uint8Array;
  fetchImpl?: typeof fetch;
}

function normalizeBase(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * Build canonical revocation JSON body and POST to `/api/revocations`.
 */
export async function postRevocation(input: PostRevocationInput): Promise<PostRevocationResult> {
  const fetchFn = input.fetchImpl ?? globalThis.fetch;
  await ready();
  const kp = await keypairFromSeed(input.kMasterSeed32);
  try {
    const msg = new TextEncoder().encode(input.certId + input.revokedAt);
    const sigBytes = await signDetached(msg, kp.secretKey);
    const signature = base64urlEncode(sigBytes);
    const body = {
      cert_id: input.certId,
      revoked_at: input.revokedAt,
      reason: input.reason,
      signature,
    };
    const res = await fetchFn(`${normalizeBase(input.apiBaseUrl)}/revocations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${input.bearerToken}`,
      },
      body: JSON.stringify(body),
    });
    if (res.status === 200 || res.status === 409) {
      return { ok: true, status: res.status as 200 | 409 };
    }
    if (res.status === 401) {
      return { ok: false, status: 401, message: "Bearer-Token erforderlich" };
    }
    if (res.status === 403) {
      return { ok: false, status: 403, message: "Signatur ungültig" };
    }
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      status: res.status,
      message: text === "" ? `HTTP ${res.status}` : text.slice(0, 240),
    };
  } finally {
    kp.secretKey.fill(0);
  }
}

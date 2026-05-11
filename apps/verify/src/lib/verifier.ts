import {
  base64urlDecode,
  masterPublicFingerprintHex,
  ready,
  sessionEndorsementMessage,
  verifyDetached,
} from "@bastiion/crypto";
import {
  certificateWireSchema,
  type CertificateWire,
  type RevocationDocWire,
} from "./certificateSchema.ts";
import { fetchVerifyStatus } from "./api.ts";
import { sliceCertificateSigningJson } from "./signingSlice.ts";

export type VerifyInput =
  | { kind: "id"; certId: string; apiBaseUrl: string }
  | { kind: "json"; raw: string; apiBaseUrl?: string };

export type TamperedReason =
  | "session_sig"
  | "certificate_sig"
  | "fingerprint_mismatch"
  | "malformed_json"
  | "revocation_sig";

export type VerificationResult =
  | {
      kind: "valid";
      certificate: CertificateWire;
      online: "no_revocation_on_file" | "skipped";
      offline: true;
    }
  | {
      kind: "revoked";
      revocationDoc: RevocationDocWire;
      revocationSigVerified: boolean;
      certificate?: CertificateWire;
    }
  | { kind: "tampered"; reason: TamperedReason }
  | { kind: "unknown"; reason: "no_offline_doc" | "id_unknown" | "network_error" };

export type VerifyDeps = {
  fetch?: typeof fetch;
};

async function verifyRevocationSignature(doc: RevocationDocWire, kMasterPublic: Uint8Array): Promise<boolean> {
  await ready();
  let sigRaw: Uint8Array;
  try {
    sigRaw = base64urlDecode(doc.signature);
  } catch {
    return false;
  }
  const msg = new TextEncoder().encode(doc.cert_id + doc.revoked_at);
  return verifyDetached(sigRaw, msg, kMasterPublic);
}

/**
 * Validates the signed payload bytes (session sig, fingerprint, certificate sig)
 * for a raw certificate JSON string.
 */
export async function verifyOfflineFromRaw(raw: string): Promise<
  | { ok: true; certificate: CertificateWire; kMasterPublic: Uint8Array }
  | { ok: false; reason: Exclude<TamperedReason, "revocation_sig"> }
> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "malformed_json" };
  }

  const decoded = certificateWireSchema.safeParse(parsed);
  if (!decoded.success) {
    return { ok: false, reason: "malformed_json" };
  }

  const cert = decoded.data;
  await ready();

  let kMasterRaw: Uint8Array;
  let kCourseRaw: Uint8Array;
  let sessionSigRaw: Uint8Array;
  let certSigRaw: Uint8Array;
  try {
    kMasterRaw = base64urlDecode(cert.K_master_public);
    kCourseRaw = base64urlDecode(cert.K_course_public);
    sessionSigRaw = base64urlDecode(cert.session_sig);
    certSigRaw = base64urlDecode(cert.certificate_sig);
  } catch {
    return { ok: false, reason: "malformed_json" };
  }

  const sessionMsg = sessionEndorsementMessage(cert.course.id, cert.valid_until, kCourseRaw);
  const sessionOk = await verifyDetached(sessionSigRaw, sessionMsg, kMasterRaw);
  if (!sessionOk) {
    return { ok: false, reason: "session_sig" };
  }

  const fp = masterPublicFingerprintHex(kMasterRaw);
  if (fp !== cert.institute.key_fingerprint) {
    return { ok: false, reason: "fingerprint_mismatch" };
  }

  const signingBytes = sliceCertificateSigningJson(raw);
  const certMessage = new TextEncoder().encode(signingBytes);
  const certOk = await verifyDetached(certSigRaw, certMessage, kCourseRaw);
  if (!certOk) {
    return { ok: false, reason: "certificate_sig" };
  }

  return { ok: true, certificate: cert, kMasterPublic: kMasterRaw };
}

function onlineBaseForJson(input: Extract<VerifyInput, { kind: "json" }>): string | undefined {
  return input.apiBaseUrl;
}

/**
 * Public verification pipeline (online + offline) for id-only and dropped JSON flows.
 */
export async function verify(input: VerifyInput, deps: VerifyDeps = {}): Promise<VerificationResult> {
  const fetchImpl = deps.fetch ?? globalThis.fetch;

  if (input.kind === "id") {
    const online = await fetchVerifyStatus(input.apiBaseUrl, input.certId, fetchImpl);
    if (online.kind === "not_found") {
      return { kind: "unknown", reason: "id_unknown" };
    }
    if (online.kind === "network_error" || online.kind === "http_error") {
      return { kind: "unknown", reason: "network_error" };
    }
    if (online.kind === "ok_no_revocation") {
      return { kind: "unknown", reason: "no_offline_doc" };
    }
    return {
      kind: "revoked",
      revocationDoc: online.revocationDoc,
      revocationSigVerified: false,
      certificate: undefined,
    };
  }

  const offline = await verifyOfflineFromRaw(input.raw);
  if (!offline.ok) {
    return { kind: "tampered", reason: offline.reason };
  }

  const { certificate: cert, kMasterPublic } = offline;

  const base = onlineBaseForJson(input);
  if (base === undefined) {
    return {
      kind: "valid",
      certificate: cert,
      online: "skipped",
      offline: true,
    };
  }

  const online = await fetchVerifyStatus(base, cert.cert_id, fetchImpl);
  if (online.kind === "not_found") {
    return { kind: "unknown", reason: "id_unknown" };
  }

  if (online.kind === "network_error" || online.kind === "http_error") {
    return {
      kind: "valid",
      certificate: cert,
      online: "skipped",
      offline: true,
    };
  }

  if (online.kind === "ok_no_revocation") {
    return {
      kind: "valid",
      certificate: cert,
      online: "no_revocation_on_file",
      offline: true,
    };
  }

  const revOk = await verifyRevocationSignature(online.revocationDoc, kMasterPublic);
  if (!revOk) {
    return { kind: "tampered", reason: "revocation_sig" };
  }

  return {
    kind: "revoked",
    revocationDoc: online.revocationDoc,
    revocationSigVerified: true,
    certificate: cert,
  };
}

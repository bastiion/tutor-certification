import { beforeAll, describe, expect, test } from "bun:test";
import {
  base64urlEncode,
  deriveSessionSeed,
  keypairFromSeed,
  masterPublicFingerprintHex,
  ready,
  sessionEndorsementMessage,
  signDetached,
} from "@bastiion/crypto";
import { verify, verifyOfflineFromRaw } from "./verifier.ts";
import { sliceCertificateSigningJson } from "./signingSlice.ts";

beforeAll(() => ready());

async function mintRawCertificate(opts?: {
  corruptSessionSig?: boolean;
  corruptCertificateSig?: boolean;
  wrongFingerprint?: boolean;
}): Promise<{ raw: string; certId: string; masterKp: Awaited<ReturnType<typeof keypairFromSeed>> }> {
  const masterSeed = new Uint8Array(32);
  crypto.getRandomValues(masterSeed);
  const masterKp = await keypairFromSeed(masterSeed);
  const courseId = crypto.randomUUID();
  const validUntil = Math.floor(Date.now() / 1000) + 86400 * 30;
  const courseSeed = await deriveSessionSeed({ ikm: masterSeed, courseId, validUntilUnix: validUntil });
  const courseKp = await keypairFromSeed(courseSeed);
  const sessionMsg = sessionEndorsementMessage(courseId, validUntil, courseKp.publicKey);
  let sessionSig = await signDetached(sessionMsg, masterKp.secretKey);
  if (opts?.corruptSessionSig) {
    const copy = new Uint8Array(sessionSig);
    const b0 = copy[0];
    if (b0 !== undefined) {
      copy[0] = b0 ^ 0xff;
    }
    sessionSig = copy;
  }
  let fp = masterPublicFingerprintHex(masterKp.publicKey);
  if (opts?.wrongFingerprint) {
    fp = `${"0".repeat(63)}f`;
  }

  const certId = crypto.randomUUID();
  const signingObj = {
    cert_id: certId,
    version: 1 as const,
    issued_at: "2026-05-11T12:00:00+00:00",
    course: { id: courseId, title: "K", date: "2026-05-11" },
    participant: { name: "Ada" },
    institute: { name: "Inst", key_fingerprint: fp },
    K_master_public: base64urlEncode(masterKp.publicKey),
    K_course_public: base64urlEncode(courseKp.publicKey),
    session_sig: base64urlEncode(sessionSig),
  };

  const signingJson = JSON.stringify(signingObj);
  let certSigBytes = await signDetached(new TextEncoder().encode(signingJson), courseKp.secretKey);
  if (opts?.corruptCertificateSig) {
    const copy = new Uint8Array(certSigBytes);
    const b0 = copy[0];
    if (b0 !== undefined) {
      copy[0] = b0 ^ 0xff;
    }
    certSigBytes = copy;
  }

  const fullObj = {
    ...signingObj,
    valid_until: validUntil,
    certificate_sig: base64urlEncode(certSigBytes),
  };

  return { raw: JSON.stringify(fullObj), certId, masterKp };
}

function mockFetchJson(status: number, body: unknown): typeof fetch {
  return (() =>
    Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    )) as unknown as typeof fetch;
}

describe("verify()", () => {
  test("json: valid offline + online no revocation", async () => {
    const { raw, certId } = await mintRawCertificate();
    const res = await verify(
      { kind: "json", raw, apiBaseUrl: "" },
      {
        fetch: mockFetchJson(200, { valid: true }),
      },
    );
    expect(res).toEqual({
      kind: "valid",
      certificate: expect.objectContaining({ cert_id: certId }) as unknown,
      online: "no_revocation_on_file",
      offline: true,
    });
  });

  test("json: valid offline + online skipped when apiBaseUrl omitted", async () => {
    const { raw } = await mintRawCertificate();
    const res = await verify({ kind: "json", raw });
    expect(res.kind).toBe("valid");
    if (res.kind === "valid") {
      expect(res.online).toBe("skipped");
    }
  });

  test("json: valid offline + revoked with valid revocation signature", async () => {
    const { raw, certId, masterKp } = await mintRawCertificate();
    const revokedAt = "2026-05-11T16:00:00.000Z";
    const msg = new TextEncoder().encode(certId + revokedAt);
    const sig = await signDetached(msg, masterKp.secretKey);
    const revocationDoc = {
      cert_id: certId,
      revoked_at: revokedAt,
      reason: "test",
      signature: base64urlEncode(sig),
    };
    const res = await verify(
      { kind: "json", raw, apiBaseUrl: "" },
      {
        fetch: mockFetchJson(200, { valid: false, revocation_doc: revocationDoc }),
      },
    );
    expect(res.kind).toBe("revoked");
    if (res.kind === "revoked") {
      expect(res.revocationSigVerified).toBe(true);
      expect(res.certificate?.cert_id).toBe(certId);
    }
  });

  test("json: valid offline + revoked with invalid revocation signature", async () => {
    const { raw, certId } = await mintRawCertificate();
    const revokedAt = "2026-05-11T16:00:00.000Z";
    const revocationDoc = {
      cert_id: certId,
      revoked_at: revokedAt,
      reason: "test",
      signature: base64urlEncode(new Uint8Array(64).fill(9)),
    };
    const res = await verify(
      { kind: "json", raw, apiBaseUrl: "" },
      {
        fetch: mockFetchJson(200, { valid: false, revocation_doc: revocationDoc }),
      },
    );
    expect(res).toEqual({ kind: "tampered", reason: "revocation_sig" });
  });

  test("json: corrupted certificate_sig", async () => {
    const { raw } = await mintRawCertificate({ corruptCertificateSig: true });
    const res = await verify({ kind: "json", raw, apiBaseUrl: "" }, { fetch: mockFetchJson(200, { valid: true }) });
    expect(res).toEqual({ kind: "tampered", reason: "certificate_sig" });
  });

  test("json: corrupted session_sig", async () => {
    const { raw } = await mintRawCertificate({ corruptSessionSig: true });
    const res = await verify({ kind: "json", raw, apiBaseUrl: "" }, { fetch: mockFetchJson(200, { valid: true }) });
    expect(res).toEqual({ kind: "tampered", reason: "session_sig" });
  });

  test("json: fingerprint mismatch", async () => {
    const { raw } = await mintRawCertificate({ wrongFingerprint: true });
    const res = await verify({ kind: "json", raw, apiBaseUrl: "" }, { fetch: mockFetchJson(200, { valid: true }) });
    expect(res).toEqual({ kind: "tampered", reason: "fingerprint_mismatch" });
  });

  test("json: malformed json", async () => {
    const res = await verify({ kind: "json", raw: "{", apiBaseUrl: "" }, { fetch: mockFetchJson(200, { valid: true }) });
    expect(res).toEqual({ kind: "tampered", reason: "malformed_json" });
  });

  test("json: empty object fails schema", async () => {
    const res = await verify({ kind: "json", raw: "{}", apiBaseUrl: "" }, { fetch: mockFetchJson(200, { valid: true }) });
    expect(res).toEqual({ kind: "tampered", reason: "malformed_json" });
  });

  test("json: offline ok + verify endpoint 404 -> id_unknown", async () => {
    const { raw, certId } = await mintRawCertificate();
    const fetch404: typeof fetch = (url) => {
      expect(String(url)).toContain(certId);
      return Promise.resolve(new Response("", { status: 404 }));
    };
    const res = await verify({ kind: "json", raw, apiBaseUrl: "" }, { fetch: fetch404 });
    expect(res).toEqual({ kind: "unknown", reason: "id_unknown" });
  });

  test("json: valid offline + revoked but revocation signature cannot be decoded", async () => {
    const { raw, certId } = await mintRawCertificate();
    const revocationDoc = {
      cert_id: certId,
      revoked_at: "2026-05-11T16:00:00.000Z",
      reason: "test",
      signature: "plus+is+invalid",
    };
    const res = await verify(
      { kind: "json", raw, apiBaseUrl: "" },
      {
        fetch: mockFetchJson(200, { valid: false, revocation_doc: revocationDoc }),
      },
    );
    expect(res).toEqual({ kind: "tampered", reason: "revocation_sig" });
  });

  test("json: valid offline + unreachable server -> valid with online skipped", async () => {
    const { raw, certId } = await mintRawCertificate();
    const res = await verify(
      { kind: "json", raw, apiBaseUrl: "" },
      {
        fetch: (() => Promise.reject(new Error("offline"))) as unknown as typeof fetch,
      },
    );
    expect(res.kind).toBe("valid");
    if (res.kind === "valid") {
      expect(res.certificate.cert_id).toBe(certId);
      expect(res.online).toBe("skipped");
    }
  });

  test("id-only: 200 valid -> unknown no_offline_doc", async () => {
    const certId = crypto.randomUUID();
    const res = await verify(
      { kind: "id", certId, apiBaseUrl: "" },
      { fetch: mockFetchJson(200, { valid: true }) },
    );
    expect(res).toEqual({ kind: "unknown", reason: "no_offline_doc" });
  });

  test("id-only: revoked -> revocationSigVerified false", async () => {
    const certId = crypto.randomUUID();
    const res = await verify(
      { kind: "id", certId, apiBaseUrl: "" },
      {
        fetch: mockFetchJson(200, {
          valid: false,
          revocation_doc: {
            cert_id: certId,
            revoked_at: "2026-05-11T16:00:00.000Z",
            reason: "r",
            signature: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
          },
        }),
      },
    );
    expect(res.kind).toBe("revoked");
    if (res.kind === "revoked") {
      expect(res.revocationSigVerified).toBe(false);
      expect(res.certificate).toBeUndefined();
    }
  });

  test("id-only: 404 -> id_unknown", async () => {
    const res = await verify(
      { kind: "id", certId: "nope", apiBaseUrl: "" },
      {
        fetch: (() => Promise.resolve(new Response("", { status: 404 }))) as unknown as typeof fetch,
      },
    );
    expect(res).toEqual({ kind: "unknown", reason: "id_unknown" });
  });

  test("id-only: network error", async () => {
    const res = await verify(
      { kind: "id", certId: crypto.randomUUID(), apiBaseUrl: "" },
      {
        fetch: (() => Promise.reject(new Error("net"))) as unknown as typeof fetch,
      },
    );
    expect(res).toEqual({ kind: "unknown", reason: "network_error" });
  });

  test("online revoked overrides offline valid", async () => {
    const { raw, certId, masterKp } = await mintRawCertificate();
    const revokedAt = "2026-05-11T16:00:00.000Z";
    const msg = new TextEncoder().encode(certId + revokedAt);
    const sig = await signDetached(msg, masterKp.secretKey);
    const revocationDoc = {
      cert_id: certId,
      revoked_at: revokedAt,
      reason: "test",
      signature: base64urlEncode(sig),
    };
    const res = await verify(
      { kind: "json", raw, apiBaseUrl: "" },
      {
        fetch: mockFetchJson(200, { valid: false, revocation_doc: revocationDoc }),
      },
    );
    expect(res.kind).toBe("revoked");
  });
});

test("slice removes signing tail fields for valid mint", async () => {
  const { raw } = await mintRawCertificate();
  expect(sliceCertificateSigningJson(raw).includes("certificate_sig")).toBe(false);
  expect(sliceCertificateSigningJson(raw).includes("valid_until")).toBe(false);
});

describe("verifyOfflineFromRaw", () => {
  test("rejects invalid base64 material after schema passes", async () => {
    const raw = JSON.stringify({
      cert_id: "00000000-0000-4000-8000-000000000001",
      version: 1,
      issued_at: "2026-05-11T12:00:00+00:00",
      course: { id: "22222222-2222-4222-8222-222222222222", title: "T", date: "2026-05-11" },
      participant: { name: "N" },
      institute: { name: "I", key_fingerprint: "abab" },
      K_master_public: "@@@",
      K_course_public: "@@@",
      session_sig: "@@@",
      valid_until: 9999999999,
      certificate_sig: "@@@",
    });
    const res = await verifyOfflineFromRaw(raw);
    expect(res).toEqual({ ok: false, reason: "malformed_json" });
  });
});

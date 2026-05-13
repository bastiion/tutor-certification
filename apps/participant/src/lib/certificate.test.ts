import {
  base64urlEncode,
  deriveSessionSeed,
  keypairFromSeed,
  masterPublicFingerprintHex,
  ready,
  sessionEndorsementMessage,
  signDetached,
} from "@bastiion/crypto";
import { parseCertificateForDisplay, verifyIssuedCertificate } from "./certificate.ts";
import { beforeAll, describe, expect, test } from "bun:test";

beforeAll(() => ready());

async function mintRawCertificateFixture(overrides?: {
  corruptSessionSig?: boolean;
  wrongFingerprint?: boolean;
}): Promise<string> {
  const masterSeed = new Uint8Array(32);
  crypto.getRandomValues(masterSeed);
  const masterKp = await keypairFromSeed(masterSeed);
  const courseId = crypto.randomUUID();
  const validUntil = Math.floor(Date.now() / 1000) + 7200;
  const courseSeed = await deriveSessionSeed({ ikm: masterSeed, courseId, validUntilUnix: validUntil });
  const courseKp = await keypairFromSeed(courseSeed);
  const msg = sessionEndorsementMessage(courseId, validUntil, courseKp.publicKey);
  let sessionSig = await signDetached(msg, masterKp.secretKey);
  if (overrides?.corruptSessionSig) {
    const copy = new Uint8Array(sessionSig);
    const b0 = copy[0];
    if (b0 !== undefined) {
      copy[0] = b0 ^ 0xff;
    }
    sessionSig = copy;
  }
  let fp = masterPublicFingerprintHex(masterKp.publicKey);
  if (overrides?.wrongFingerprint) {
    fp = `${"0".repeat(63)}f`;
  }
  const fakeCourseSig = new Uint8Array(64);
  crypto.getRandomValues(fakeCourseSig);
  const blob = {
    cert_id: crypto.randomUUID(),
    version: 1,
    issued_at: "2026-05-11T12:00:00+00:00",
    course: { id: courseId, title: "Kurs", date: "2026-05-11" },
    participant: { name: "Ada" },
    institute: { name: "Inst", key_fingerprint: fp },
    K_master_public: base64urlEncode(masterKp.publicKey),
    K_course_public: base64urlEncode(courseKp.publicKey),
    session_sig: base64urlEncode(sessionSig),
    valid_until: validUntil,
    certificate_sig: base64urlEncode(fakeCourseSig),
  };
  return JSON.stringify(blob);
}

describe("verifyIssuedCertificate", () => {
  test("accepts a well-formed issued certificate JSON string", async () => {
    const raw = await mintRawCertificateFixture();
    const res = await verifyIssuedCertificate(raw);
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.cert.cert_id.length).toBeGreaterThan(0);
      expect(res.cert.course.id.length).toBeGreaterThan(0);
    }
  });

  test("rejects corrupted session_sig", async () => {
    const raw = await mintRawCertificateFixture({ corruptSessionSig: true });
    const res = await verifyIssuedCertificate(raw);
    expect(res).toEqual({ ok: false, reason: "session_sig" });
  });

  test("rejects fingerprint mismatch", async () => {
    const raw = await mintRawCertificateFixture({ wrongFingerprint: true });
    const res = await verifyIssuedCertificate(raw);
    expect(res).toEqual({ ok: false, reason: "fingerprint_mismatch" });
  });

  test("rejects when valid_until disagrees with session_sig", async () => {
    const raw = await mintRawCertificateFixture();
    const obj = JSON.parse(raw) as { valid_until: number };
    obj.valid_until = obj.valid_until + 999;
    const res = await verifyIssuedCertificate(JSON.stringify(obj));
    expect(res).toEqual({ ok: false, reason: "session_sig" });
  });

  test("rejects schema violations", async () => {
    const res = await verifyIssuedCertificate("{}");
    expect(res).toEqual({ ok: false, reason: "schema" });
  });

  test("rejects invalid JSON", async () => {
    const res = await verifyIssuedCertificate("not-json");
    expect(res).toEqual({ ok: false, reason: "parse" });
  });

  test("rejects invalid base64url fields after schema passes shape", async () => {
    const raw = JSON.stringify({
      cert_id: "x",
      version: 1,
      course: { id: "c".repeat(36) },
      institute: { name: "i", key_fingerprint: "f".repeat(64) },
      K_master_public: "@@@",
      K_course_public: base64urlEncode(new Uint8Array(32)),
      session_sig: base64urlEncode(new Uint8Array(64)),
      valid_until: 1,
      certificate_sig: base64urlEncode(new Uint8Array(64)),
    });
    const res = await verifyIssuedCertificate(raw);
    expect(res).toEqual({ ok: false, reason: "schema" });
  });

  test("parseCertificateForDisplay maps known fields", () => {
    const raw = JSON.stringify({
      cert_id: "cid",
      participant: { name: "N" },
      course: { title: "T", date: "D" },
      institute: { name: "I", key_fingerprint: "fp" },
    });
    expect(parseCertificateForDisplay(raw)).toEqual({
      certId: "cid",
      participantName: "N",
      courseTitle: "T",
      courseDate: "D",
      instituteName: "I",
      keyFingerprint: "fp",
    });
  });

  test("parseCertificateForDisplay tolerates missing optional fields", () => {
    expect(parseCertificateForDisplay("{}")).toEqual({
      certId: "",
      participantName: "",
      courseTitle: "",
      courseDate: "",
      instituteName: "",
      keyFingerprint: "",
    });
  });

  test("parseCertificateForDisplay ignores non-string field shapes", () => {
    const raw = JSON.stringify({
      cert_id: 1,
      participant: { name: null },
      course: { title: true, date: [] },
      institute: { name: 3, key_fingerprint: {} },
    });
    expect(parseCertificateForDisplay(raw)).toEqual({
      certId: "",
      participantName: "",
      courseTitle: "",
      courseDate: "",
      instituteName: "",
      keyFingerprint: "",
    });
  });

  test("parseCertificateForDisplay throws on invalid JSON", () => {
    expect(() => parseCertificateForDisplay("not-json")).toThrow();
  });
});

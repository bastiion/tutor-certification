import { beforeAll, describe, expect, test } from "bun:test";
import sodium from "libsodium-wrappers";
import {
  base64urlDecode,
  base64urlEncode,
  boxSealOpen,
  deriveSessionSeed,
  keypairFromSeed,
  masterPublicFingerprintHex,
  ready,
  sessionEndorsementMessage,
  verifyDetached,
} from "@bastiion/crypto";
import {
  buildCanonicalSessionCredential,
  isBase64UrlNoPadding,
  validateSessionInputs,
  type SessionInputs,
} from "./canonicalCredential.ts";
import hkdfVector from "../../../../packages/crypto/test-vectors/hkdf-cert-course-key-001.json" with {
  type: "json",
};

beforeAll(async () => {
  await ready();
  await sodium.ready;
});

function fixedSeed(byte: number): Uint8Array {
  return new Uint8Array(32).fill(byte);
}

function makeInputs(overrides: Partial<SessionInputs> = {}): SessionInputs {
  return {
    courseId: "018f5b2e-4b2a-7000-9000-abcdef123456",
    validUntilUnix: 1_780_000_000,
    courseTitle: "Stage 3 Demo Kurs",
    courseDate: "2026-05-11",
    instituteName: "Example Institute",
    tutorEmail: "tutor@example.test",
    kMasterSeed: fixedSeed(0xab),
    serverBoxPublicKey: sodium.crypto_box_keypair().publicKey,
    ...overrides,
  };
}

describe("validateSessionInputs", () => {
  test("rejects empty string fields", () => {
    expect(() => validateSessionInputs(makeInputs({ courseId: "" }))).toThrow(/courseId/);
    expect(() => validateSessionInputs(makeInputs({ courseTitle: "" }))).toThrow(/courseTitle/);
    expect(() => validateSessionInputs(makeInputs({ instituteName: "" }))).toThrow(/instituteName/);
    expect(() => validateSessionInputs(makeInputs({ tutorEmail: "" }))).toThrow(/tutorEmail/);
  });

  test("rejects non-string field types", () => {
    expect(() => validateSessionInputs(makeInputs({ courseDate: undefined as unknown as string })),
    ).toThrow(/courseDate/);
  });

  test("requires a non-negative integer validUntilUnix", () => {
    expect(() => validateSessionInputs(makeInputs({ validUntilUnix: -1 }))).toThrow(/validUntilUnix/);
    expect(() => validateSessionInputs(makeInputs({ validUntilUnix: 1.5 }))).toThrow(/validUntilUnix/);
    expect(() => validateSessionInputs(makeInputs({ validUntilUnix: Number.NaN }))).toThrow(
      /validUntilUnix/,
    );
  });

  test("requires courseDate matching YYYY-MM-DD", () => {
    expect(() => validateSessionInputs(makeInputs({ courseDate: "11.05.2026" }))).toThrow(
      /YYYY-MM-DD/,
    );
  });

  test("requires kMasterSeed to be a 32-byte Uint8Array", () => {
    expect(() => validateSessionInputs(makeInputs({ kMasterSeed: new Uint8Array(31) }))).toThrow(
      RangeError,
    );
    expect(() =>
      validateSessionInputs(
        makeInputs({ kMasterSeed: "deadbeef" as unknown as Uint8Array }),
      ),
    ).toThrow(TypeError);
  });

  test("requires serverBoxPublicKey to be a 32-byte Uint8Array", () => {
    expect(() =>
      validateSessionInputs(makeInputs({ serverBoxPublicKey: new Uint8Array(33) })),
    ).toThrow(RangeError);
  });
});

describe("buildCanonicalSessionCredential", () => {
  test("produces every snake_case field with base64url-no-padding bytes", async () => {
    const recipient = sodium.crypto_box_keypair();
    const inputs = makeInputs({ serverBoxPublicKey: recipient.publicKey });
    const cred = await buildCanonicalSessionCredential(inputs);

    expect(cred.course_id).toBe(inputs.courseId);
    expect(cred.valid_until).toBe(inputs.validUntilUnix);
    expect(cred.course_title).toBe(inputs.courseTitle);
    expect(cred.course_date).toBe(inputs.courseDate);
    expect(cred.institute_name).toBe(inputs.instituteName);

    for (const field of [
      "K_master_public",
      "K_course_public",
      "session_sig",
      "K_course_private_enc",
    ] as const) {
      expect(isBase64UrlNoPadding(cred[field])).toBe(true);
    }

    expect(cred.K_master_public_fingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  test("session_sig verifies under the embedded K_master_public over the canonical endorsement message", async () => {
    const inputs = makeInputs();
    const cred = await buildCanonicalSessionCredential(inputs);

    const masterPk = base64urlDecode(cred.K_master_public);
    const coursePk = base64urlDecode(cred.K_course_public);
    const sig = base64urlDecode(cred.session_sig);

    const expectedMsg = sessionEndorsementMessage(
      inputs.courseId,
      inputs.validUntilUnix,
      coursePk,
    );
    expect(await verifyDetached(sig, expectedMsg, masterPk)).toBe(true);
  });

  test("K_course_public matches the HKDF + Ed25519 derivation from the same seed", async () => {
    const inputs = makeInputs();
    const cred = await buildCanonicalSessionCredential(inputs);

    const courseSeed = await deriveSessionSeed({
      ikm: inputs.kMasterSeed,
      courseId: inputs.courseId,
      validUntilUnix: inputs.validUntilUnix,
    });
    const courseKp = await keypairFromSeed(courseSeed);

    expect(cred.K_course_public).toBe(base64urlEncode(courseKp.publicKey));
  });

  test("K_course_private_enc round-trips with the recipient keypair to the libsodium course secretKey", async () => {
    const recipient = sodium.crypto_box_keypair();
    const inputs = makeInputs({ serverBoxPublicKey: recipient.publicKey });
    const cred = await buildCanonicalSessionCredential(inputs);

    const ciphertext = base64urlDecode(cred.K_course_private_enc);
    const opened = await boxSealOpen(ciphertext, {
      publicKey: recipient.publicKey,
      secretKey: recipient.privateKey,
    });
    expect(opened).not.toBeNull();

    const courseSeed = await deriveSessionSeed({
      ikm: inputs.kMasterSeed,
      courseId: inputs.courseId,
      validUntilUnix: inputs.validUntilUnix,
    });
    const courseKp = await keypairFromSeed(courseSeed);

    expect(opened!.length).toBe(courseKp.secretKey.length);
    for (let i = 0; i < opened!.length; i++) {
      expect(opened![i]).toBe(courseKp.secretKey[i]);
    }
  });

  test("K_master_public_fingerprint matches BLAKE2b-256 of the embedded K_master_public", async () => {
    const cred = await buildCanonicalSessionCredential(makeInputs());
    const masterPk = base64urlDecode(cred.K_master_public);
    expect(cred.K_master_public_fingerprint).toBe(masterPublicFingerprintHex(masterPk));
  });

  test("uses the same HKDF info encoding as the shared crypto vector", async () => {
    const inputs = makeInputs({
      courseId: hkdfVector.course_id,
      validUntilUnix: hkdfVector.valid_until_unix,
      kMasterSeed: base64urlDecode(hkdfVector.ikm_b64),
    });
    const cred = await buildCanonicalSessionCredential(inputs);
    const expectedSeed = base64urlDecode(hkdfVector.expected_okm_b64);
    const expectedKp = await keypairFromSeed(expectedSeed);
    expect(cred.K_course_public).toBe(base64urlEncode(expectedKp.publicKey));
  });

  test("input validation runs before any crypto", async () => {
    await expect(
      buildCanonicalSessionCredential(makeInputs({ courseId: "" })),
    ).rejects.toThrow(/courseId/);
  });
});

describe("isBase64UrlNoPadding", () => {
  test("accepts only the URL-safe alphabet without padding", () => {
    expect(isBase64UrlNoPadding("AbCd-_09")).toBe(true);
    expect(isBase64UrlNoPadding("AB+/=")).toBe(false);
    expect(isBase64UrlNoPadding("")).toBe(false);
    expect(isBase64UrlNoPadding(42 as unknown as string)).toBe(false);
  });
});

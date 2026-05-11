/**
 * Node-side crypto for Cypress tasks — mirrors {@link SessionCredentialFixture} / PHP rules.
 */

import sodium from "libsodium-wrappers";
import {
  base64urlEncode,
  boxSeal,
  deriveSessionSeed,
  keypairFromSeed,
  masterPublicFingerprintHex,
  ready,
  sessionEndorsementMessage,
  signDetached,
  base64urlDecode,
} from "@bastiion/crypto";

export interface MintSessionCredentialOpts {
  courseId?: string;
  validUntilUnix?: number;
  /**
   * Convenience: `validUntilUnix = floor(now/1000) + offset`.
   * Ignored when `validUntilUnix` is provided explicitly.
   */
  validUntilOffsetSeconds?: number;
}

export interface MintSessionCredentialResult {
  credential: Record<string, unknown>;
  /** Base64 (standard) encoding of 64-byte Ed25519 master secret key (libsodium layout). */
  masterSecretKey64B64: string;
}

export interface SignRevocationOpts {
  certId: string;
  revokedAt: string;
  masterSecretKey64B64: string;
}

export interface SignRevocationResult {
  signature: string;
}

function uint8ToStdBase64(u: Uint8Array): string {
  const chunk = 0x8000;
  let bin = "";
  for (let i = 0; i < u.length; i += chunk) {
    bin += String.fromCharCode(...u.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function stdBase64ToUint8(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function serverBoxPublicKeyFromEnv(): Uint8Array {
  const raw = process.env.SERVER_BOX_KEYPAIR_BASE64;
  if (raw === undefined || raw.trim() === "") {
    throw new Error("SERVER_BOX_KEYPAIR_BASE64 is required for mintSessionCredential");
  }
  const bin = base64urlDecode(raw.trim());
  if (bin.length !== 64) {
    throw new Error("SERVER_BOX_KEYPAIR_BASE64 must decode to 64 bytes");
  }
  return bin.subarray(32, 64);
}

/** @public Cypress task */
export async function mintSessionCredential(
  opts: MintSessionCredentialOpts = {},
): Promise<MintSessionCredentialResult> {
  await ready();
  await sodium.ready;

  const courseId =
    typeof opts.courseId === "string" && opts.courseId.trim() !== ""
      ? opts.courseId.trim()
      : crypto.randomUUID();

  let validUntilUnix: number;
  if (typeof opts.validUntilUnix === "number" && Number.isFinite(opts.validUntilUnix)) {
    validUntilUnix = Math.floor(opts.validUntilUnix);
  } else if (typeof opts.validUntilOffsetSeconds === "number" && Number.isFinite(opts.validUntilOffsetSeconds)) {
    validUntilUnix = Math.floor(Date.now() / 1000) + Math.floor(opts.validUntilOffsetSeconds);
  } else {
    validUntilUnix = Math.floor(Date.now() / 1000) + 86400 * 30;
  }

  const masterSeed = sodium.randombytes_buf(32);
  const masterKp = sodium.crypto_sign_seed_keypair(masterSeed);
  const masterPk = masterKp.publicKey;
  const masterSk = masterKp.privateKey;

  const courseSeed = await deriveSessionSeed({
    ikm: masterSeed,
    courseId,
    validUntilUnix,
  });
  const courseKp = await keypairFromSeed(courseSeed);

  const msg = sessionEndorsementMessage(courseId, validUntilUnix, courseKp.publicKey);
  const sig = await signDetached(msg, masterSk);

  const serverPk = serverBoxPublicKeyFromEnv();
  const enc = await boxSeal(courseKp.secretKey, serverPk);

  const credential: Record<string, unknown> = {
    course_id: courseId,
    valid_until: validUntilUnix,
    course_title: "E2E Kurs",
    course_date: "2026-05-11",
    institute_name: "Example Institute",
    K_master_public: base64urlEncode(masterPk),
    K_course_public: base64urlEncode(courseKp.publicKey),
    K_master_public_fingerprint: masterPublicFingerprintHex(masterPk),
    session_sig: base64urlEncode(sig),
    K_course_private_enc: base64urlEncode(enc),
  };

  return {
    credential,
    masterSecretKey64B64: uint8ToStdBase64(masterSk),
  };
}

/** @public Cypress task */
export async function signRevocationDocument(
  opts: SignRevocationOpts,
): Promise<SignRevocationResult> {
  await ready();
  await sodium.ready;

  const sk = stdBase64ToUint8(opts.masterSecretKey64B64);
  if (sk.length !== sodium.crypto_sign_SECRETKEYBYTES) {
    throw new RangeError("master secret key must be 64 bytes (base64-decoded)");
  }

  const messageUtf8 = opts.certId + opts.revokedAt;
  const msg = new TextEncoder().encode(messageUtf8);
  const sig = sodium.crypto_sign_detached(msg, sk);

  return { signature: base64urlEncode(sig) };
}

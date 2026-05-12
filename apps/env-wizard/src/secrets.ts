import sodium from "libsodium-wrappers";

/** Concatenate libsodium box secret + public keys in the PHP-compatible layout. @internal exported for tests */
export function concatBoxKeypairBytes(sk: Uint8Array, pk: Uint8Array): Uint8Array {
  if (sk.length !== 32 || pk.length !== 32) {
    throw new Error("Unexpected crypto_box keypair sizes from libsodium-wrappers");
  }
  const pair64 = new Uint8Array(64);
  pair64.set(sk, 0);
  pair64.set(pk, 32);
  return pair64;
}

export interface GeneratedSecrets {
  SERVER_BOX_KEYPAIR_BASE64: string;
  TOKEN_HMAC_KEY_BASE64: string;
  /** 64-char hex (32 random bytes), bearer for tutor API routes */
  TUTOR_API_TOKEN: string;
}

function uint8ToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i]!.toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Libsodium `crypto_box` keypair as `secretKey(32) || publicKey(32)`, URL-safe Base64 without padding
 * — matches PHP `sodium_crypto_box_secretkey($kp) . sodium_crypto_box_publickey($kp)`.
 */
export async function generateSecrets(): Promise<GeneratedSecrets> {
  await sodium.ready;

  const kp = sodium.crypto_box_keypair();
  const sk = kp.privateKey;
  const pk = kp.publicKey;
  const pair64 = concatBoxKeypairBytes(sk, pk);

  const tokenKey32 = sodium.randombytes_buf(32);
  const tutorToken = uint8ToHex(sodium.randombytes_buf(32));

  return {
    SERVER_BOX_KEYPAIR_BASE64: sodium.to_base64(pair64, sodium.base64_variants.URLSAFE_NO_PADDING),
    TOKEN_HMAC_KEY_BASE64: sodium.to_base64(tokenKey32, sodium.base64_variants.URLSAFE_NO_PADDING),
    TUTOR_API_TOKEN: tutorToken,
  };
}

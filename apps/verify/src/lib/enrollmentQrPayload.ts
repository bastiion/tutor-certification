import { base64urlDecode } from "@bastiion/crypto";

/**
 * Stage 4 QR content: base64url(UTF-8 bytes of raw certificate JSON).
 */
export function rawCertificateJsonFromQrPayload(qrText: string): string {
  const bytes = base64urlDecode(qrText.trim());
  return new TextDecoder().decode(bytes);
}

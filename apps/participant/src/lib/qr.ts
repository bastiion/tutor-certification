import { base64urlEncode } from "@bastiion/crypto";
import QRCode from "qrcode";

/**
 * QR carries the **raw** HTTP response body string, base64url-encoded (UTF-8 bytes).
 */
export function enrollmentQrPayloadFromRawBody(rawCertificateResponseBody: string): string {
  return base64urlEncode(new TextEncoder().encode(rawCertificateResponseBody));
}

export async function qrCodeSvgForPayload(data: string): Promise<string> {
  return QRCode.toString(data, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
  });
}

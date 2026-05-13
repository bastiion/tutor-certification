import { base64urlEncode } from "@bastiion/crypto";
import QRCode from "qrcode";

/**
 * Stage 4/5 QR: raw Base64URL(UTF-8 of the enrolment HTTP JSON body).
 */
export function enrollmentQrPayloadFromRawBody(rawCertificateResponseBody: string): string {
  return base64urlEncode(new TextEncoder().encode(rawCertificateResponseBody));
}

/**
 * Stage 6b printable QR encodes `…/verify/#cert=<payload>` so a phone camera lands in the verifier.
 *
 * If the verify SPA is ever deployed on another origin, expose `verify_base_url` via `GET /api/health`
 * and substitute it here instead of coupling to `Participant` SPA origin (`Stage 6b plan — out of scope`).
 */
export function qrUrlForCertResponse(rawCertificateResponseBody: string, verifyBaseUrl: string): string {
  const base = verifyBaseUrl.endsWith("/") ? verifyBaseUrl : `${verifyBaseUrl}/`;
  return `${base}#cert=${enrollmentQrPayloadFromRawBody(rawCertificateResponseBody)}`;
}

export async function qrCodeSvgForPayload(data: string): Promise<string> {
  return QRCode.toString(data, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 256,
  });
}

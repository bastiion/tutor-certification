/**
 * Strip non-signing fields from the certificate HTTP response body string so the
 * remainder byte-matches PHP {@see Certificate::toSigningJson()}.
 *
 * The API adds `valid_until` and `certificate_sig` after `session_sig`; both must be
 * removed from the raw UTF-8 JSON string without re-serialising.
 */

export function sliceCertificateSigningJson(rawBody: string): string {
  let out = rawBody;
  out = out.replace(/,"valid_until":\d+/, "");
  out = out.replace(/,"certificate_sig":"[A-Za-z0-9_-]+"/, "");
  return out;
}

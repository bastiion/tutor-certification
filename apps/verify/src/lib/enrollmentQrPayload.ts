import { base64urlDecode } from "@bastiion/crypto";

/**
 * Normalise pasted / scanned verifier QR payloads: full `https://…/verify/#cert=…`
 * URLs, `#cert=` fragment-only snippets, or raw base64url (Stage ≤6 legacy QR).
 *
 * Returns the inner base64url certificate blob suitable for {@link rawCertificateJsonFromQrPayload}.
 */
export function stripQrUrlPrefix(qrText: string): string {
  const t = qrText.trim();
  if (t === "") {
    throw new RangeError("Leerer QR-Inhalt.");
  }

  const lc = t.toLowerCase();

  if (lc.startsWith("#cert=")) {
    const decoded = decodeURIComponent(t.slice("#cert=".length).trimStart());
    if (decoded.trim() === "") {
      throw new RangeError("QR-Inhalt ohne Zertifikatsdaten nach #cert=.");
    }

    return decoded;
  }

  if (lc.startsWith("http://") || lc.startsWith("https://")) {
    let url: URL;
    try {
      url = new URL(t);
    } catch {
      throw new RangeError("Ungültige Verifizierungs-URL.");
    }

    const hash = url.hash.trim();
    if (!hash.startsWith("#cert=")) {
      throw new RangeError('QR-Verifizierungslink erwartet einen Anker #cert=….');
    }

    const fragmentValue = decodeURIComponent(hash.slice("#cert=".length).trimStart());
    if (fragmentValue.trim() === "") {
      throw new RangeError("QR-Inhalt ohne Zertifikatsdaten nach #cert=.");
    }

    return fragmentValue;
  }

  return t;
}

/**
 * Stage ≥6b QR: URL-wrapped (#cert=payload), or Stage 4/5 QR: raw base64url(UTF-8 cert JSON bytes).
 */
export function rawCertificateJsonFromQrPayload(qrText: string): string {
  const inner = stripQrUrlPrefix(qrText);
  const bytes = base64urlDecode(inner);

  return new TextDecoder().decode(bytes);
}

/** Textarea paste: unchanged JSON `{…}`; otherwise treat as QR (URL / `#cert=` / base64url). */
export function coerceVerifyClipboardOrQrText(raw: string): string {
  const t = raw.trim();
  if (t.startsWith("{")) {
    return raw;
  }

  return rawCertificateJsonFromQrPayload(raw);
}

/**
 * Verify drop-zone: JSON + QR image today; PDF reserved for a later stage.
 */

export const VERIFY_JSON_MAX_BYTES = 64 * 1024;
export const VERIFY_IMAGE_MAX_BYTES = 4 * 1024 * 1024;

export const VERIFY_FILE_ACCEPT_ATTR =
  "application/json,.json,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp";

/** Reserved for future PDF decoding (e.g. extract embedded QR raster). */
export const VERIFY_FUTURE_PDF_MIME = "application/pdf";

export type VerifyInboundKind = "json" | "image" | "unknown";

export function classifyVerifyFile(file: File): VerifyInboundKind {
  const name = file.name.toLowerCase();
  const mime = (file.type ?? "").toLowerCase().trim();

  if (
    mime === VERIFY_FUTURE_PDF_MIME ||
    mime.startsWith(`${VERIFY_FUTURE_PDF_MIME};`) ||
    name.endsWith(".pdf")
  ) {
    return "unknown";
  }

  if (
    mime === "application/json" ||
    mime.startsWith("application/json;") ||
    mime === "text/json" ||
    name.endsWith(".json")
  ) {
    return "json";
  }

  if (
    mime === "image/png" ||
    mime === "image/jpeg" ||
    mime === "image/webp" ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp")
  ) {
    return "image";
  }

  return "unknown";
}

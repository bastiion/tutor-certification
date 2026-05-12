/**
 * Allowed inbound MIME / extensions for tutor audit import (Stage 6).
 * Central registry so future formats (e.g. PDF) plug in without rewiring UI.
 */

export const TUTOR_INBOUND_ACCEPT_ATTR =
  "application/json,.json,message/rfc822,.eml,application/mbox,.mbox";

/** Future: register `application/pdf` + PDF-specific parser. */
export const TUTOR_INBOUND_REGISTRY = {
  json: {
    mimeTypes: new Set(["application/json", "text/json"]),
    extensions: new Set([".json"]),
  },
  emailMessage: {
    mimeTypes: new Set(["message/rfc822", "text/x-mail"]),
    extensions: new Set([".eml"]),
  },
  mbox: {
    mimeTypes: new Set(["application/mbox"]),
    extensions: new Set([".mbox"]),
  },
} as const;

export type TutorInboundKind = keyof typeof TUTOR_INBOUND_REGISTRY;

export function classifyTutorInboundFile(file: File): TutorInboundKind | "unknown" {
  const name = file.name.toLowerCase();
  const mime = (file.type ?? "").toLowerCase().trim();

  for (const kind of Object.keys(TUTOR_INBOUND_REGISTRY) as TutorInboundKind[]) {
    const spec = TUTOR_INBOUND_REGISTRY[kind];
    if (mime !== "" && [...spec.mimeTypes].some((m) => mime === m || mime.startsWith(`${m};`))) {
      return kind;
    }
  }
  for (const kind of Object.keys(TUTOR_INBOUND_REGISTRY) as TutorInboundKind[]) {
    const spec = TUTOR_INBOUND_REGISTRY[kind];
    for (const ext of spec.extensions) {
      if (name.endsWith(ext)) {
        return kind;
      }
    }
  }
  return "unknown";
}

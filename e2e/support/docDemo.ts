/**
 * Deterministic demo data and helpers for the doc-screenshots spec.
 *
 * All strings here appear verbatim in the captured screenshots.
 * Keep them consistent across Pass A and Pass B.
 */

export const DOC_DEMO = {
  participantName: "Maja Beispiel",
  courseTitle: "Selbstverteidigung — Grundkurs",
  courseDate: "2026-05-15",
  instituteName: "Beispiel-Institut e.V.",
  tutorEmail: "tutor@beispiel.test",
  frozenDate: new Date("2026-05-15T10:00:00Z"),
  validUntilOffsetDays: 7,
  revocationReason: "Doppelt eingeschrieben (Demo)",
} as const;

export const FROZEN_TIMESTAMP = DOC_DEMO.frozenDate.getTime();

export const STORAGE_KEY_PREFIX = "serverConfig:";
export const E2E_KM_B64URL_KEY = "tutor_e2e_km_b64url";

export function apiBaseUrl(): string {
  const base = Cypress.config("baseUrl") ?? "http://localhost:7123";
  return `${base.replace(/\/+$/, "")}/api`;
}

export function primeSessionStorage(
  win: Cypress.AUTWindow,
  opts: { bearer: string; masterSeedBase64Url: string },
): void {
  const api = apiBaseUrl();
  win.sessionStorage.setItem(
    `${STORAGE_KEY_PREFIX}${api}`,
    JSON.stringify({ apiBaseUrl: api, tutorApiToken: opts.bearer }),
  );
  win.sessionStorage.setItem(E2E_KM_B64URL_KEY, opts.masterSeedBase64Url);
}

export function setGermanLocale(win: Cypress.AUTWindow): void {
  Object.defineProperty(win.navigator, "language", { get: () => "de-DE" });
  Object.defineProperty(win.navigator, "languages", { get: () => ["de-DE", "de"] });
}

export const EXPECTED_SCREENSHOTS = [
  "tutor-01-home",
  "tutor-02-keys-empty",
  "tutor-03-keys-generated",
  "tutor-04-server-config",
  "tutor-05-create-session-form",
  "tutor-06-session-result",
  "tutor-07-audit-empty",
  "tutor-08-audit-imported",
  "tutor-09-revocation-form",
  "tutor-10-revocation-confirmed",
  "tutor-11-mailpit-inbox",
  "tutor-12-mailpit-message",
  "tutor-13-mailpit-attachment",
  "teiln-01-link-form",
  "teiln-02-link-filled",
  "teiln-03-cert-view",
  "teiln-04-actions",
  "teiln-05-expired",
  "pruef-01-landing",
  "pruef-02-id-only-unknown",
  "pruef-03-drop-valid",
  "pruef-04-drop-revoked",
  "pruef-05-drop-tampered",
  "pruef-06-details-expanded",
] as const;

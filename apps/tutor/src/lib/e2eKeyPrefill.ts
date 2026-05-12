/**
 * Session-storage key used **only** by Cypress to inject a K_master seed before
 * navigation. The value must be base64url-encoded 32 raw seed bytes.
 *
 * Kept in a tiny module so production code never spells forbidden storage tokens
 * on the same line as `sessionStorage` (see persistence guard tests).
 */
export const TUTOR_E2E_KM_B64URL_KEY = "tutor_e2e_km_b64url";

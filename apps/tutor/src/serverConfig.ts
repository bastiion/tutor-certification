/**
 * Server-config persistence layer for the tutor SPA.
 *
 * - Validates user input with a strict Zod schema (`apiBaseUrl`, `tutorApiToken`).
 * - Persists the validated config to a `Storage`-shaped backend (default
 *   `sessionStorage`), keyed by the API base URL so multiple environments
 *   never collide in one tab.
 * - Caches the X25519 server box public key separately so a stale or
 *   missing fetch result is always detected by the page rendering layer.
 *
 * Pure module: never touches React. The React provider lives in
 * `ServerConfig.tsx` and wires this module to `sessionStorage`.
 */

import { z } from "zod";

/** RFC 4648 §5 alphabet (URL-safe), no padding, length divisible by 4 modulo 4. */
const BASE64URL_NO_PAD_RE = /^[A-Za-z0-9_-]+$/;

const apiBaseUrlSchema = z
  .string()
  .trim()
  .min(1, "API-Basis-URL ist erforderlich.")
  .superRefine((value, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({ code: "custom", message: "API-Basis-URL muss eine vollständige URL sein." });
      return;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      ctx.addIssue({ code: "custom", message: "API-Basis-URL muss http:// oder https:// verwenden." });
    }
  });

export const serverConfigInputSchema = z.object({
  apiBaseUrl: apiBaseUrlSchema,
  tutorApiToken: z.string().trim().min(1, "Tutor-Bearer-Token ist erforderlich."),
});

export type ServerConfigInput = z.infer<typeof serverConfigInputSchema>;

/** Valid configuration as persisted (canonical: trimmed, no trailing slash on the base URL). */
export interface ServerConfig {
  readonly apiBaseUrl: string;
  readonly tutorApiToken: string;
}

const STORAGE_PREFIX = "serverConfig:";
const SERVER_KEY_STORAGE_PREFIX = "serverPublicKey:";

/** Storage-shaped subset we depend on (matches `window.sessionStorage`). */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Strip trailing slashes so storage keys and request URLs are stable. */
function canonicaliseBaseUrl(raw: string): string {
  let v = raw.trim();
  while (v.endsWith("/")) v = v.slice(0, -1);
  return v;
}

function storageKey(apiBaseUrl: string): string {
  return `${STORAGE_PREFIX}${canonicaliseBaseUrl(apiBaseUrl)}`;
}

function publicKeyStorageKey(apiBaseUrl: string): string {
  return `${SERVER_KEY_STORAGE_PREFIX}${canonicaliseBaseUrl(apiBaseUrl)}`;
}

/** Validate raw user input and produce a canonical {@link ServerConfig}. */
export function parseServerConfig(input: unknown): ServerConfig {
  const parsed = serverConfigInputSchema.parse(input);
  return {
    apiBaseUrl: canonicaliseBaseUrl(parsed.apiBaseUrl),
    tutorApiToken: parsed.tutorApiToken.trim(),
  };
}

/** Type-narrow probe used by the React layer before calling parsing helpers. */
export function isServerConfigInput(value: unknown): value is ServerConfigInput {
  return serverConfigInputSchema.safeParse(value).success;
}

/**
 * Persist a validated config under its API-base-URL-keyed slot.
 *
 * Re-validates the input first so callers can pass raw form values.
 */
export function saveServerConfig(input: unknown, storage: KeyValueStorage): ServerConfig {
  const config = parseServerConfig(input);
  storage.setItem(storageKey(config.apiBaseUrl), JSON.stringify(config));
  return config;
}

/**
 * Load a stored config for `apiBaseUrl` (after canonicalisation).
 *
 * Returns `null` if missing, malformed JSON, or fails schema validation —
 * callers must surface a "konfigurieren" CTA in any of these cases.
 */
export function loadServerConfig(apiBaseUrl: string, storage: KeyValueStorage): ServerConfig | null {
  const raw = storage.getItem(storageKey(apiBaseUrl));
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = serverConfigInputSchema.safeParse(parsed);
  if (!result.success) return null;
  return {
    apiBaseUrl: canonicaliseBaseUrl(result.data.apiBaseUrl),
    tutorApiToken: result.data.tutorApiToken.trim(),
  };
}

/** Clear a stored config and its associated public-key cache. */
export function clearServerConfig(apiBaseUrl: string, storage: KeyValueStorage): void {
  storage.removeItem(storageKey(apiBaseUrl));
  storage.removeItem(publicKeyStorageKey(apiBaseUrl));
}

/** Cache the server X25519 public key (base64url, 32 bytes when decoded). */
export function cacheServerPublicKey(
  apiBaseUrl: string,
  base64Url: string,
  storage: KeyValueStorage,
): void {
  if (!BASE64URL_NO_PAD_RE.test(base64Url)) {
    throw new SyntaxError("server public key must be URL-safe Base64 (no padding)");
  }
  storage.setItem(publicKeyStorageKey(apiBaseUrl), base64Url);
}

/** Read the cached server X25519 public key for `apiBaseUrl`. Returns `null` when absent. */
export function readCachedServerPublicKey(
  apiBaseUrl: string,
  storage: KeyValueStorage,
): string | null {
  const raw = storage.getItem(publicKeyStorageKey(apiBaseUrl));
  if (raw === null) return null;
  if (!BASE64URL_NO_PAD_RE.test(raw)) return null;
  return raw;
}

/** Public schema for the `GET /api/server-public-key` JSON envelope. */
export const serverPublicKeyResponseSchema = z.object({
  x25519_pk: z
    .string()
    .min(1)
    .refine((v) => BASE64URL_NO_PAD_RE.test(v), "x25519_pk must be URL-safe Base64 (no padding)"),
});

export type ServerPublicKeyResponse = z.infer<typeof serverPublicKeyResponseSchema>;

/** Best-effort default for `apiBaseUrl` derived from the current page origin. */
export function defaultApiBaseUrl(origin?: string): string {
  if (typeof origin === "string" && origin !== "") {
    return canonicaliseBaseUrl(`${origin}/api`);
  }
  return "http://localhost:7123/api";
}

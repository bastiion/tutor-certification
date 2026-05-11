/**
 * React layer over the {@link import("./serverConfig.ts")} module.
 *
 * Owns the API base URL + tutor bearer token (stored in `sessionStorage`)
 * and the X25519 server box public key fetched from `/api/server-public-key`
 * (cached in `sessionStorage`, re-fetched on config changes).
 *
 * On a failed fetch the provider exposes `serverKey: null` and an error
 * string so pages can render a blocking "Server-Schlüssel nicht erreichbar"
 * panel rather than letting the user proceed with stale data.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  base64urlDecode,
  ready as cryptoReady,
} from "@bastiion/crypto";
import {
  cacheServerPublicKey,
  defaultApiBaseUrl,
  loadServerConfig,
  parseServerConfig,
  readCachedServerPublicKey,
  saveServerConfig,
  serverPublicKeyResponseSchema,
  type KeyValueStorage,
  type ServerConfig,
} from "./serverConfig.ts";

export type ServerKeyState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; base64Url: string; bytes: Uint8Array }
  | { status: "error"; message: string };

export interface ServerConfigContextValue {
  config: ServerConfig | null;
  serverKey: ServerKeyState;
  saveConfig: (raw: { apiBaseUrl: string; tutorApiToken: string }) => ServerConfig;
  refreshServerKey: () => Promise<void>;
}

const ServerConfigContext = createContext<ServerConfigContextValue | null>(null);

export interface ServerConfigProviderProps {
  children: ReactNode;
  /** Inject for tests; defaults to `window.sessionStorage`. */
  storage?: KeyValueStorage;
  /** Inject for tests; defaults to `globalThis.fetch`. */
  fetchImpl?: typeof fetch;
  /** Inject for tests; defaults to `defaultApiBaseUrl(window.location.origin)`. */
  initialApiBaseUrl?: string;
}

function defaultStorage(): KeyValueStorage {
  if (typeof window !== "undefined" && typeof window.sessionStorage !== "undefined") {
    return window.sessionStorage as unknown as KeyValueStorage;
  }
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

function defaultFetch(): typeof fetch {
  if (typeof fetch !== "function") {
    throw new Error("fetch is not available in this environment");
  }
  return fetch.bind(globalThis);
}

function browserOrigin(): string {
  if (typeof window !== "undefined" && typeof window.location !== "undefined") {
    return window.location.origin ?? "";
  }
  return "";
}

export function ServerConfigProvider({
  children,
  storage,
  fetchImpl,
  initialApiBaseUrl,
}: ServerConfigProviderProps) {
  const storageRef = useRef<KeyValueStorage>(storage ?? defaultStorage());
  const fetchRef = useRef<typeof fetch>(fetchImpl ?? defaultFetch());

  const [config, setConfig] = useState<ServerConfig | null>(() => {
    const base = initialApiBaseUrl ?? defaultApiBaseUrl(browserOrigin());
    return loadServerConfig(base, storageRef.current);
  });

  const [serverKey, setServerKey] = useState<ServerKeyState>(() => {
    if (config === null) return { status: "idle" };
    const cached = readCachedServerPublicKey(config.apiBaseUrl, storageRef.current);
    if (cached === null) return { status: "idle" };
    try {
      const bytes = base64urlDecode(cached);
      if (bytes.length !== 32) return { status: "idle" };
      return { status: "ready", base64Url: cached, bytes };
    } catch {
      return { status: "idle" };
    }
  });

  const refreshServerKey = useCallback(async (): Promise<void> => {
    if (config === null) {
      setServerKey({ status: "idle" });
      return;
    }
    setServerKey({ status: "loading" });
    try {
      const res = await fetchRef.current(`${config.apiBaseUrl}/server-public-key`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        setServerKey({
          status: "error",
          message: `Server-Schlüssel nicht erreichbar (HTTP ${res.status})`,
        });
        return;
      }
      const json = (await res.json()) as unknown;
      const parsed = serverPublicKeyResponseSchema.safeParse(json);
      if (!parsed.success) {
        setServerKey({
          status: "error",
          message: "Server-Schlüssel: ungültige Antwort vom Backend",
        });
        return;
      }
      await cryptoReady();
      const bytes = base64urlDecode(parsed.data.x25519_pk);
      if (bytes.length !== 32) {
        setServerKey({
          status: "error",
          message: "Server-Schlüssel hat unerwartete Länge (≠ 32 Byte)",
        });
        return;
      }
      cacheServerPublicKey(config.apiBaseUrl, parsed.data.x25519_pk, storageRef.current);
      setServerKey({ status: "ready", base64Url: parsed.data.x25519_pk, bytes });
    } catch (err) {
      setServerKey({
        status: "error",
        message:
          err instanceof Error
            ? `Server-Schlüssel nicht erreichbar: ${err.message}`
            : "Server-Schlüssel nicht erreichbar",
      });
    }
  }, [config]);

  useEffect(() => {
    if (config === null) return;
    void refreshServerKey();
  }, [config, refreshServerKey]);

  const saveConfig = useCallback(
    (raw: { apiBaseUrl: string; tutorApiToken: string }): ServerConfig => {
      const validated = parseServerConfig(raw);
      saveServerConfig(validated, storageRef.current);
      setConfig(validated);
      return validated;
    },
    [],
  );

  const value = useMemo<ServerConfigContextValue>(
    () => ({ config, serverKey, saveConfig, refreshServerKey }),
    [config, serverKey, saveConfig, refreshServerKey],
  );

  return <ServerConfigContext.Provider value={value}>{children}</ServerConfigContext.Provider>;
}

export function useServerConfig(): ServerConfigContextValue {
  const ctx = useContext(ServerConfigContext);
  if (ctx === null) {
    throw new Error("useServerConfig must be used inside a <ServerConfigProvider>");
  }
  return ctx;
}

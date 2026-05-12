/**
 * React layer over the pure {@link createKeyVaultStore} state machine.
 *
 * - Exposes a `KeyVaultProvider` that memoises one `KeyVaultStore` instance
 *   per React tree so siblings share the same in-memory `K_master` seed.
 * - `useKeyVault()` returns `{ snapshot, store }` and re-renders whenever the
 *   store's `revision` changes. The seed itself is **never** placed in React
 *   state — components call `store.exportSeed()` only at sign time.
 *
 * No production code path writes K_master material to browser storage APIs.
 * End-to-end tests may stash a **one-shot** base64url-encoded 32-byte blob under
 * {@link TUTOR_E2E_KM_B64URL_KEY}; it is consumed and removed on startup.
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
import { base64urlDecode, ready as cryptoReady } from "@bastiion/crypto";
import { TUTOR_E2E_KM_B64URL_KEY } from "./lib/e2eKeyPrefill.ts";
import {
  createKeyVaultStore,
  type KeyVaultSnapshot,
  type KeyVaultStore,
} from "./lib/keyVaultStore.ts";

interface KeyVaultContextValue {
  snapshot: KeyVaultSnapshot;
  store: KeyVaultStore;
}

const KeyVaultContext = createContext<KeyVaultContextValue | null>(null);

export interface KeyVaultProviderProps {
  children: ReactNode;
  /** Inject a custom store for tests. */
  store?: KeyVaultStore;
}

export function KeyVaultProvider({ children, store }: KeyVaultProviderProps) {
  const storeRef = useRef<KeyVaultStore | null>(store ?? null);
  if (storeRef.current === null) {
    storeRef.current = createKeyVaultStore();
  }
  const stableStore = storeRef.current;

  const [snapshot, setSnapshot] = useState<KeyVaultSnapshot>(() => stableStore.snapshot());

  useEffect(() => {
    return stableStore.subscribe(setSnapshot);
  }, [stableStore]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") {
      return;
    }
    const raw = window.sessionStorage.getItem(TUTOR_E2E_KM_B64URL_KEY);
    if (raw === null || raw === "") {
      return;
    }
    let cancelled = false;
    void (async () => {
      await cryptoReady();
      if (cancelled) {
        return;
      }
      let bytes: Uint8Array;
      try {
        bytes = base64urlDecode(raw);
      } catch {
        window.sessionStorage.removeItem(TUTOR_E2E_KM_B64URL_KEY);
        return;
      }
      if (bytes.length !== 32) {
        window.sessionStorage.removeItem(TUTOR_E2E_KM_B64URL_KEY);
        return;
      }
      try {
        stableStore.importSeed(bytes);
      } finally {
        bytes.fill(0);
        window.sessionStorage.removeItem(TUTOR_E2E_KM_B64URL_KEY);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [stableStore]);

  const value = useMemo<KeyVaultContextValue>(
    () => ({ snapshot, store: stableStore }),
    [snapshot, stableStore],
  );

  return <KeyVaultContext.Provider value={value}>{children}</KeyVaultContext.Provider>;
}

export function useKeyVault(): KeyVaultContextValue {
  const ctx = useContext(KeyVaultContext);
  if (ctx === null) {
    throw new Error("useKeyVault must be used inside a <KeyVaultProvider>");
  }
  return ctx;
}

/**
 * Trigger a browser download of the current seed as `kmaster-YYYYMMDD-HHmmss.key`.
 *
 * Reads the seed via `store.exportSeed()` (defensive copy), then turns it
 * into a `Blob` so the user lands the same 32 bytes on disk as the SPA holds
 * in memory. The function is exported so the `Keys` page can call it on the
 * generate flow without re-deriving the file naming logic.
 */
export function downloadSeedAsKeyFile(seed: Uint8Array, now: Date = new Date()): void {
  if (typeof document === "undefined" || typeof URL === "undefined" || typeof URL.createObjectURL !== "function") {
    return;
  }
  const blob = new Blob([seed], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = formatDownloadFilename(now);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function pad(n: number, width: number): string {
  return n.toString().padStart(width, "0");
}

export function formatDownloadFilename(now: Date): string {
  const yyyy = pad(now.getFullYear(), 4);
  const mm = pad(now.getMonth() + 1, 2);
  const dd = pad(now.getDate(), 2);
  const hh = pad(now.getHours(), 2);
  const mi = pad(now.getMinutes(), 2);
  const ss = pad(now.getSeconds(), 2);
  return `kmaster-${yyyy}${mm}${dd}-${hh}${mi}${ss}.key`;
}

export function useKeyVaultActions() {
  const { store } = useKeyVault();
  const generate = useCallback((): void => {
    store.generate();
    const exported = store.exportSeed();
    try {
      downloadSeedAsKeyFile(exported);
    } finally {
      exported.fill(0);
    }
  }, [store]);

  const importFromArrayBuffer = useCallback(
    (buf: ArrayBuffer): void => {
      const bytes = new Uint8Array(buf);
      try {
        store.importSeed(bytes);
      } finally {
        bytes.fill(0);
      }
    },
    [store],
  );

  const forget = useCallback((): void => {
    store.forget();
  }, [store]);

  return { generate, importFromArrayBuffer, forget };
}

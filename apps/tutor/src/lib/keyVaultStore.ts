/**
 * Pure imperative key-vault state machine.
 *
 * Holds the tutor's `K_master` 32-byte Ed25519 seed in **memory only**.
 * Never touches `localStorage`, `sessionStorage`, `indexedDB`, cookies, or
 * `console.*` — that policy is enforced by the
 * `apps/tutor/src/__tests__/persistence.guard.test.ts` grep test.
 *
 * The React layer (`KeyVault.tsx`) wraps this store in a Provider and
 * exposes `useKeyVault()` so components can subscribe to changes.
 */

const KMASTER_SEED_BYTES = 32;

/** Snapshot returned to subscribers — never includes the raw seed. */
export interface KeyVaultSnapshot {
  /** `true` once a seed has been generated or imported. */
  readonly hasSeed: boolean;
  /** Increments on every successful `generate`/`import`/`forget`. */
  readonly revision: number;
}

/** Imperative API for managing `K_master` in a single JS realm. */
export interface KeyVaultStore {
  snapshot(): KeyVaultSnapshot;
  /** Replace the seed with `bytes` (must be exactly 32 bytes). */
  importSeed(bytes: Uint8Array): KeyVaultSnapshot;
  /** Generate a fresh seed using `getRandomBytes` and store it. */
  generate(): KeyVaultSnapshot;
  /**
   * Read the current seed for one-shot use (e.g. signing).
   *
   * @throws {Error} if no seed has been generated/imported yet.
   */
  exportSeed(): Uint8Array;
  /** Wipe the seed in place and clear all in-memory references. */
  forget(): KeyVaultSnapshot;
  /** Subscribe to snapshot changes; returns an unsubscribe handle. */
  subscribe(listener: (snapshot: KeyVaultSnapshot) => void): () => void;
}

/** Optional dependency injection — defaults to `crypto.getRandomValues`. */
export interface KeyVaultStoreOptions {
  /** RNG used by {@link KeyVaultStore.generate}; must fill exactly 32 bytes. */
  getRandomBytes?: (length: number) => Uint8Array;
}

function defaultGetRandomBytes(length: number): Uint8Array {
  const out = new Uint8Array(length);
  crypto.getRandomValues(out);
  return out;
}

/**
 * Construct an in-memory key vault.
 *
 * The returned object is the **only** place the seed lives in the JS realm.
 * Always invoke {@link KeyVaultStore.forget} when the user logs out.
 */
export function createKeyVaultStore(options: KeyVaultStoreOptions = {}): KeyVaultStore {
  const getRandomBytes = options.getRandomBytes ?? defaultGetRandomBytes;

  let seed: Uint8Array | null = null;
  let revision = 0;
  const listeners = new Set<(snapshot: KeyVaultSnapshot) => void>();

  function snapshot(): KeyVaultSnapshot {
    return { hasSeed: seed !== null, revision };
  }

  function notify(): KeyVaultSnapshot {
    revision += 1;
    const snap = snapshot();
    for (const listener of listeners) listener(snap);
    return snap;
  }

  function wipe(): void {
    if (seed !== null) {
      seed.fill(0);
      seed = null;
    }
  }

  return {
    snapshot,
    importSeed(bytes: Uint8Array): KeyVaultSnapshot {
      if (!(bytes instanceof Uint8Array)) {
        throw new TypeError("importSeed expects a Uint8Array");
      }
      if (bytes.length !== KMASTER_SEED_BYTES) {
        throw new RangeError(`K_master seed must be exactly ${KMASTER_SEED_BYTES} bytes`);
      }
      wipe();
      seed = new Uint8Array(bytes);
      return notify();
    },
    generate(): KeyVaultSnapshot {
      const bytes = getRandomBytes(KMASTER_SEED_BYTES);
      if (!(bytes instanceof Uint8Array) || bytes.length !== KMASTER_SEED_BYTES) {
        throw new Error(`getRandomBytes must return ${KMASTER_SEED_BYTES} bytes`);
      }
      wipe();
      seed = new Uint8Array(bytes);
      return notify();
    },
    exportSeed(): Uint8Array {
      if (seed === null) {
        throw new Error("KeyVault is empty — generate or import a seed first");
      }
      return new Uint8Array(seed);
    },
    forget(): KeyVaultSnapshot {
      wipe();
      return notify();
    },
    subscribe(listener: (snapshot: KeyVaultSnapshot) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

export const KMASTER_SEED_LENGTH = KMASTER_SEED_BYTES;

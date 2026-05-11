/**
 * Tutor key onboarding: generate or import `K_master`.
 *
 * - "Generieren" mints a fresh 32-byte seed via `crypto.getRandomValues`,
 *   stores it in {@link useKeyVault}'s in-memory ref, and immediately offers
 *   the same bytes for download as `kmaster-YYYYMMDD-HHmmss.key`.
 * - "Importieren" reads a `.key` file (raw 32-byte seed) and rejects
 *   anything else with a German-language error message.
 * - "Vergessen" wipes the seed.
 *
 * The full BLAKE2b-256 fingerprint of `K_master_public` is rendered for the
 * tutor to verify; an abbreviated form is shown inline for compactness.
 */

import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import {
  keypairFromSeed,
  masterPublicFingerprintHex,
  ready as cryptoReady,
} from "@bastiion/crypto";
import { Link } from "../Link.tsx";
import { downloadSeedAsKeyFile, useKeyVault } from "../KeyVault.tsx";

const SEED_LENGTH = 32;

function abbreviateFingerprint(full: string): string {
  return full.length > 16 ? `${full.slice(0, 16)}…` : full;
}

export function Keys() {
  const { snapshot, store } = useKeyVault();
  const [error, setError] = useState<string | null>(null);
  const [fingerprint, setFingerprint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!snapshot.hasSeed) {
      setFingerprint(null);
      return;
    }
    void (async () => {
      await cryptoReady();
      const seed = store.exportSeed();
      try {
        const kp = await keypairFromSeed(seed);
        if (!cancelled) {
          setFingerprint(masterPublicFingerprintHex(kp.publicKey));
        }
      } finally {
        seed.fill(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [snapshot, store]);

  const fpAbbrev = useMemo(
    () => (fingerprint === null ? null : abbreviateFingerprint(fingerprint)),
    [fingerprint],
  );

  function handleGenerate(): void {
    setError(null);
    store.generate();
    const seed = store.exportSeed();
    try {
      downloadSeedAsKeyFile(seed);
    } finally {
      seed.fill(0);
    }
  }

  function handleImport(event: ChangeEvent<HTMLInputElement>): void {
    setError(null);
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file === undefined) return;
    const reader = new FileReader();
    reader.onerror = () => setError("Datei konnte nicht gelesen werden.");
    reader.onload = () => {
      const result = reader.result;
      if (!(result instanceof ArrayBuffer)) {
        setError("Datei konnte nicht gelesen werden.");
        return;
      }
      if (result.byteLength !== SEED_LENGTH) {
        setError(`Schlüsseldatei muss genau ${SEED_LENGTH} Byte enthalten.`);
        return;
      }
      const bytes = new Uint8Array(result);
      try {
        store.importSeed(bytes);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import fehlgeschlagen.");
      } finally {
        bytes.fill(0);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function handleForget(): void {
    setError(null);
    store.forget();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10" data-cy="tutor-keys">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          K_master verwalten
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Der private Schlüssel bleibt ausschließlich im aktuellen Browser-Tab —
          er wird nirgendwo persistiert. Beim Schließen des Tabs ist er weg.
        </p>
      </header>

      <section className="space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleGenerate}
            data-cy="keys-generate"
            className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
          >
            Schlüssel generieren
          </button>

          <label className="inline-flex cursor-pointer items-center rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50">
            <span>Schlüssel importieren</span>
            <input
              type="file"
              accept=".key,application/octet-stream"
              className="ml-3 text-xs"
              onChange={handleImport}
              data-cy="keys-import"
            />
          </label>

          <button
            type="button"
            onClick={handleForget}
            disabled={!snapshot.hasSeed}
            data-cy="keys-forget"
            className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-800 shadow-sm hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Schlüssel vergessen
          </button>
        </div>

        {error ? (
          <p
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
            data-cy="keys-error"
          >
            {error}
          </p>
        ) : null}

        <div className="border-t border-stone-200 pt-4 text-sm">
          {snapshot.hasSeed ? (
            <p data-cy="keys-loaded">
              Schlüssel geladen. Fingerprint (BLAKE2b-256):
              <br />
              <code className="mt-1 inline-block rounded bg-stone-100 px-2 py-1" data-cy="keys-fingerprint">
                {fpAbbrev ?? "wird berechnet …"}
              </code>
              {fingerprint ? (
                <span className="sr-only" data-cy="keys-fingerprint-full">
                  {fingerprint}
                </span>
              ) : null}
            </p>
          ) : (
            <p className="text-stone-600" data-cy="keys-empty">
              Noch kein Schlüssel geladen. Generiere einen neuen oder importiere eine{" "}
              <code>.key</code>-Datei.
            </p>
          )}
        </div>
      </section>

      <p className="mt-6 text-sm text-stone-600">
        <Link to="sessions/new" className="text-amber-700 underline hover:text-amber-800">
          Weiter zu „Sitzung erstellen“
        </Link>
      </p>
    </div>
  );
}

export default Keys;

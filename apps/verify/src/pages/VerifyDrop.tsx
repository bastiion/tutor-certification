import { useCallback, useState, type ReactElement } from "react";
import type { VerificationResult } from "../lib/verifier.ts";
import { verify } from "../lib/verifier.ts";
import { VerificationVerdict } from "../VerificationVerdict.tsx";

const MAX_BYTES = 64 * 1024;

export function VerifyDrop(): React.ReactElement {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runVerify = useCallback((body: string) => {
    setError(null);
    setLoading(true);
    void verify({ kind: "json", raw: body, apiBaseUrl: "" })
      .then((r) => setResult(r))
      .finally(() => setLoading(false));
  }, []);

  const onFile = useCallback(
    (file: File) => {
      if (file.size > MAX_BYTES) {
        setError("Datei zu groß (maximal 64 KB).");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        setRaw(text);
        runVerify(text);
      };
      reader.readAsText(file, "UTF-8");
    },
    [runVerify],
  );

  return (
    <section className="mx-auto max-w-xl p-8" data-cy="verify-drop">
      <h1 className="text-xl font-semibold text-stone-900">Bescheinigung prüfen</h1>
      <p className="mt-3 text-sm text-stone-600">
        Legen Sie die Bescheinigungsdatei ab (JSON) oder fügen Sie den Inhalt ein. Es werden keine Daten an Dritte
        gesendet — nur eine Abfrage auf derselben Seite bei <code className="rounded bg-stone-200 px-1">/api/verify</code>
        .
      </p>

      <div
        className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-white px-6 py-10 text-center text-sm text-stone-600 hover:border-sky-400"
        data-cy="drop-zone"
        onDragOver={(e) => {
          e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files[0];
          if (f) {
            onFile(f);
          }
        }}
      >
        <label className="cursor-pointer">
          <span className="font-medium text-sky-800">JSON-Datei auswählen</span>
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              if (f) {
                onFile(f);
              }
            }}
          />
        </label>
        <p className="mt-2 text-xs text-stone-500">oder hierher ziehen</p>
      </div>

      <div className="mt-6">
        <label className="block text-sm font-medium text-stone-800" htmlFor="verify-paste">
          JSON einfügen
        </label>
        <textarea
          id="verify-paste"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          rows={8}
          className="mt-2 w-full rounded-md border border-stone-300 p-3 font-mono text-sm text-stone-900 shadow-sm"
          spellCheck={false}
          data-cy="paste-area"
        />
        <button
          type="button"
          className="mt-3 rounded-md bg-sky-800 px-4 py-2 text-sm font-medium text-white hover:bg-sky-900"
          onClick={() => {
            runVerify(raw);
          }}
          data-cy="paste-submit"
        >
          Prüfen
        </button>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-red-700" data-cy="drop-error">
          {error}
        </p>
      ) : null}

      <div className="mt-8">
        <VerificationVerdict result={result} loading={loading} />
      </div>
    </section>
  );
}

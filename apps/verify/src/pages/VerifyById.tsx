import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import type { VerificationResult } from "../lib/verifier.ts";
import { verify } from "../lib/verifier.ts";
import { VerificationVerdict } from "../VerificationVerdict.tsx";

export function VerifyById(props: { certId: string }): ReactElement {
  const { certId } = props;
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void verify({ kind: "id", certId, apiBaseUrl: "" })
      .then((r) => {
        if (!cancelled) {
          setResult(r);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [certId]);

  return (
    <section className="mx-auto max-w-xl p-8" data-cy="verify-by-id">
      <h1 className="text-xl font-semibold text-stone-900">Online-Prüfung</h1>
      <p className="mt-3 text-sm text-stone-600">
        Bescheinigungs-ID: <code className="rounded bg-stone-200 px-1">{certId}</code>
      </p>
      <p className="mt-2 text-sm text-stone-600">
        Für eine vollständige kryptographische Prüfung laden Sie die JSON-Bescheinigungsdatei unter{" "}
        <a className="text-sky-700 underline" href="/verify/">
          /verify/
        </a>{" "}
        hoch.
      </p>
      <div className="mt-6">
        <VerificationVerdict result={result} loading={loading} />
      </div>
    </section>
  );
}

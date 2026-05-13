import { useEffect, useState } from "react";
import { CURRENT_CERT_SCHEMA_VERSION } from "@bastiion/crypto";
import { qrCodeSvgForPayload, qrUrlForCertResponse } from "../lib/qr.ts";
import { parseCertificateForDisplay, verifyIssuedCertificate } from "../lib/certificate.ts";

function printPage() {
  if (typeof window !== "undefined") {
    window.print();
  }
}

function readSchemaVersion(rawBody: string): number | undefined {
  try {
    const o = JSON.parse(rawBody) as { schema_version?: unknown };
    return typeof o.schema_version === "number" ? o.schema_version : undefined;
  } catch {
    return undefined;
  }
}

export function CertView(props: { rawBody: string }) {
  const [svg, setSvg] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [schemaWarning, setSchemaWarning] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const v = await verifyIssuedCertificate(props.rawBody);
      if (cancelled) return;
      if (!v.ok) {
        setGateError(
          "Diese Bescheinigung konnte nicht verifiziert werden und wird nicht angezeigt. Bitte wenden Sie sich an die Kursleitung.",
        );
        return;
      }

      const sv = readSchemaVersion(props.rawBody);
      if (sv !== undefined && sv !== CURRENT_CERT_SCHEMA_VERSION) {
        setSchemaWarning(
          `Hinweis: Dieses Zertifikat meldet Schema-Version ${String(sv)} — erwartet wird ${String(CURRENT_CERT_SCHEMA_VERSION)}.`,
        );
      }

      const verifyBaseUrl =
        typeof window !== "undefined" ? `${window.location.origin}/verify/` : "/verify/";
      const qrUrl = qrUrlForCertResponse(props.rawBody, verifyBaseUrl);

      try {
        const nextSvg = await qrCodeSvgForPayload(qrUrl);
        if (!cancelled) {
          setSvg(nextSvg);
        }
      } catch {
        if (!cancelled) setSvg(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.rawBody]);

  if (gateError) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <p className="text-red-800" data-cy="certificate-gate-error">
          {gateError}
        </p>
      </main>
    );
  }

  const d = parseCertificateForDisplay(props.rawBody);
  const downloadHref = `data:application/json;charset=utf-8,${encodeURIComponent(props.rawBody)}`;
  const downloadName = `bescheinigung-${d.certId}.json`;

  const typeVerifyUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/verify/${encodeURIComponent(d.certId)}`
      : `/verify/${encodeURIComponent(d.certId)}`;

  return (
    <div className="print-area">
      <div className="no-print mx-auto max-w-3xl space-y-4 p-6">
        <div className="flex flex-wrap gap-2">
          <a
            className="inline-flex rounded border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-900 shadow-sm hover:bg-stone-50"
            data-cy="download-json"
            href={downloadHref}
            download={downloadName}
          >
            JSON herunterladen
          </a>
          <button
            type="button"
            className="inline-flex rounded bg-stone-900 px-3 py-2 text-sm font-medium text-white shadow hover:bg-stone-800"
            data-cy="print"
            onClick={() => printPage()}
          >
            Drucken
          </button>
          <a className="inline-flex items-center rounded px-3 py-2 text-sm text-amber-800 underline" href="/verify/">
            Vollständige Prüfung (offline)
          </a>
        </div>
      </div>

      <section className="certificate-sheet mx-auto max-w-3xl bg-white px-8 py-10 shadow md:rounded-lg md:border md:border-stone-200">
        <p className="text-center text-sm uppercase tracking-wide text-stone-500">Teilnahmebescheinigung</p>
        <h1
          className="mt-2 text-center print:text-5xl text-3xl font-bold text-stone-900 md:text-4xl"
          data-cy="institute-name"
        >
          {d.instituteName}
        </h1>
        <p className="mt-8 text-center text-sm text-stone-600">Teilnehmer/in</p>
        <p className="mt-1 text-center print:text-4xl text-2xl font-semibold text-stone-900" data-cy="certificate-name">
          {d.participantName}
        </p>
        <p className="mt-6 text-center text-sm text-stone-600">Kurs</p>
        <p className="mt-1 text-center text-lg font-medium text-stone-900">{d.courseTitle}</p>
        <p className="mt-1 text-center text-sm text-stone-700">{d.courseDate}</p>

        {schemaWarning ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 no-print">
            {schemaWarning}
          </p>
        ) : null}

        <div className="mt-8 flex flex-wrap items-end justify-between gap-6 border-t border-stone-200 pt-6">
          <div className="min-w-[200px]">
            <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Instituts-Fingerprint</p>
            <p className="mt-1 break-all font-mono text-xs text-stone-800" data-cy="certificate-fingerprint">
              {d.keyFingerprint}
            </p>
            <p className="mt-3 text-xs text-stone-500">
              Zertifikats-ID: <span className="font-mono text-stone-800">{d.certId}</span>
            </p>
          </div>
          <div className="ml-auto text-center">
            {svg ? (
              <div
                className="inline-block [&_svg]:h-auto [&_svg]:max-w-[160px] md:[&_svg]:max-w-[200px]"
                data-cy="certificate-qr"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            ) : (
              <p className="text-sm text-stone-500">QR-Code wird erzeugt…</p>
            )}
            <p className="mt-2 font-mono text-xs text-stone-600" data-cy="certificate-id-foot">
              {d.certId}
            </p>
          </div>
        </div>

        {d.certId !== "" ? (
          <p
            className="mt-4 text-xs not-italic text-stone-600"
            data-cy="certificate-verify-caption"
          >
            Diese Bescheinigung kann unter{" "}
            <span className="font-mono">{typeVerifyUrl}</span> oder durch Scannen des nebenstehenden QR-Codes
            geprüft werden.
          </p>
        ) : null}
      </section>
    </div>
  );
}

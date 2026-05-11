import type { VerificationResult } from "./lib/verifier.ts";
import { useState, type ReactElement } from "react";

function tamperedReasonDe(reason: string): string {
  switch (reason) {
    case "session_sig":
      return "Session-Signatur ungültig";
    case "certificate_sig":
      return "Bescheinigungs-Signatur ungültig";
    case "fingerprint_mismatch":
      return "Fingerabdruck passt nicht zum eingebetteten Institutsschlüssel";
    case "malformed_json":
      return "Kein gültiges Bescheinigungs-JSON";
    case "revocation_sig":
      return "Sperr-Signatur passt nicht zum eingebetteten Institutsschlüssel";
    default:
      return reason;
  }
}

export function VerificationVerdict(props: {
  result: VerificationResult | null;
  loading?: boolean;
}): ReactElement | null {
  const { result, loading } = props;
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <p className="text-stone-600" data-cy="verify-loading">
        Prüfe…
      </p>
    );
  }

  if (result === null) {
    return null;
  }

  if (result.kind === "valid") {
    return (
      <div
        className="print-area rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm"
        data-cy="status-valid"
      >
        <h2 className="text-lg font-semibold text-emerald-900">Gültig (offline bestätigt)</h2>
        <p className="mt-2 text-sm text-emerald-900">
          Die Bescheinigungsdatei ist kryptographisch konsistent (Session, Bescheinigung und Instituts-Fingerabdruck).
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {result.online === "no_revocation_on_file" ? (
            <span
              className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-900"
              data-cy="chip-online-no-revocation"
            >
              Server: keine Sperrung eingetragen
            </span>
          ) : (
            <span
              className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-900"
              data-cy="chip-online-skipped"
            >
              Online-Prüfung nicht durchgeführt
            </span>
          )}
        </div>
        <DetailsToggle open={open} onToggle={() => setOpen(!open)} result={result} />
      </div>
    );
  }

  if (result.kind === "revoked") {
    const caveat = !result.revocationSigVerified;
    return (
      <div
        className="print-area rounded-lg border border-red-200 bg-red-50 p-4 shadow-sm"
        data-cy="status-revoked"
      >
        <h2 className="text-lg font-semibold text-red-900">Gesperrt</h2>
        <p className="mt-1 text-sm text-red-900">
          Diese Bescheinigung ist gesperrt
          {result.revocationDoc.reason ? ` — ${result.revocationDoc.reason}` : ""}.
        </p>
        <p className="mt-1 text-xs text-red-800">Sperrdatum: {result.revocationDoc.revoked_at}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {caveat ? (
            <span
              className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-900"
              data-cy="revocation-not-offline-verified"
            >
              Sperr-Signatur nicht offline geprüft — nur Server-bestätigt; Bescheinigungsdatei zur Offline-Prüfung
              hochladen
            </span>
          ) : (
            <span
              className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-900"
              data-cy="revocation-offline-verified"
            >
              Sperr-Signatur offline geprüft
            </span>
          )}
        </div>
        <DetailsToggle open={open} onToggle={() => setOpen(!open)} result={result} />
      </div>
    );
  }

  if (result.kind === "tampered") {
    return (
      <div
        className="print-area rounded-lg border border-amber-200 bg-amber-50 p-4 shadow-sm"
        data-cy="status-tampered"
        data-tampered-reason={result.reason}
      >
        <h2 className="text-lg font-semibold text-amber-900">Manipulation erkannt</h2>
        <p className="mt-2 text-sm text-amber-900" data-cy="tampered-explanation">
          {tamperedReasonDe(result.reason)}
        </p>
        <p className="mt-2 text-xs text-amber-800">
          Bitte wenden Sie sich an die ausstellende Stelle und fordern Sie eine neue JSON-Bescheinigung an.
        </p>
        <DetailsToggle open={open} onToggle={() => setOpen(!open)} result={result} />
      </div>
    );
  }

  // unknown
  const sub = result.reason;
  const body =
    sub === "no_offline_doc" ? (
      <>
        <p className="text-sm text-stone-700">
          Server: keine Sperrung eingetragen. Für eine vollständige Prüfung Bescheinigungsdatei hochladen oder
          QR-Code-Inhalt einfügen.
        </p>
        <p className="mt-2 text-xs text-stone-500">
          Hinweis: Der Server bestätigt Ihre Bescheinigungs-ID nicht — es wird nur geprüft, ob eine Sperrung existiert.
        </p>
      </>
    ) : sub === "id_unknown" ? (
      <p className="text-sm text-stone-700">Bescheinigungs-ID unbekannt oder ungültig.</p>
    ) : (
      <p className="text-sm text-stone-700">
        Server nicht erreichbar — vollständige Offline-Prüfung möglich durch Hochladen der Bescheinigungsdatei.
      </p>
    );

  return (
    <div
      className="print-area rounded-lg border border-stone-200 bg-stone-50 p-4 shadow-sm"
      data-cy="status-unknown"
      data-unknown-reason={sub}
    >
      <h2 className="text-lg font-semibold text-stone-800">Unbekannt / eingeschränkte Prüfung</h2>
      <div className="mt-2">{body}</div>
      {sub === "no_offline_doc" ? (
        <p className="mt-3 text-sm">
          <a className="text-sky-700 underline" href="/verify/" data-cy="link-upload-hint">
            Zur vollständigen Prüfung Datei hier ablegen
          </a>
        </p>
      ) : null}
      <DetailsToggle open={open} onToggle={() => setOpen(!open)} result={result} />
    </div>
  );
}

function DetailsToggle(props: {
  open: boolean;
  onToggle: () => void;
  result: VerificationResult;
}): ReactElement {
  const { open, onToggle, result } = props;
  return (
    <div className="mt-4">
      <button
        type="button"
        className="text-sm font-medium text-sky-800 underline"
        onClick={onToggle}
        data-cy="details-toggle"
      >
        {open ? "Details ausblenden" : "Details anzeigen"}
      </button>
      {open ? (
        <pre
          className="mt-2 max-h-64 overflow-auto rounded bg-white/80 p-3 text-xs text-stone-700"
          data-cy="details-panel"
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

import { useState } from "react";
import { navigateParticipant } from "../router.ts";
import { verifyIssuedCertificate } from "../lib/certificate.ts";
import { postEnrollment } from "../lib/enrollApi.ts";
import { Expired } from "./Expired.tsx";

export function EnrollForm(props: { token: string; onIssued: (rawBody: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notFoundAfterSubmit, setNotFoundAfterSubmit] = useState(false);

  if (notFoundAfterSubmit) {
    return <Expired variant="invalid-token" />;
  }

  const submit = async () => {
    setServerError(null);
    const trimmedName = name.trim();
    if (trimmedName === "") {
      setClientError("Name ist erforderlich.");
      return;
    }
    setClientError(null);

    const trimmedMail = email.trim();
    const emailField = trimmedMail === "" ? null : trimmedMail;

    setLoading(true);
    try {
      const result = await postEnrollment(props.token, { name: trimmedName, email: emailField });
      if (result.ok === false && result.kind === "gone") {
        navigateParticipant("/enroll/expired");
        return;
      }
      if (result.ok === false && result.kind === "not_found") {
        setNotFoundAfterSubmit(true);
        return;
      }
      if (result.ok === false && result.kind === "bad_request") {
        setServerError(result.message);
        return;
      }
      if (result.ok === false) {
        setServerError(result.message);
        return;
      }

      const verified = await verifyIssuedCertificate(result.rawBody);
      if (!verified.ok) {
        setServerError(
          verified.reason === "fingerprint_mismatch"
            ? "Die ausgestellte Bescheinigung enthält eine unerwartete Instituts-Fingerprints — bitte Kursleitung informieren."
            : "Die ausgestellte Bescheinigung konnte nicht geprüft werden. Bitte versuchen Sie es erneut oder wenden Sie sich an die Kursleitung.",
        );
        return;
      }

      props.onIssued(result.rawBody);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-xl p-8 no-print">
      <h1 className="text-xl font-semibold text-stone-900">Teilnahmebescheinigung ausstellen</h1>
      <p className="mt-3 text-sm text-stone-600">
        Geben Sie Ihren Namen ein. Nach dem Absenden wird Ihre Bescheinigung in diesem Browser angezeigt.
      </p>

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <label className="block text-sm font-medium text-stone-800" htmlFor="participant-name">
            Name
          </label>
          <input
            id="participant-name"
            className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm"
            data-cy="name-input"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          {clientError ? <p className="mt-1 text-sm text-red-700">{clientError}</p> : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-800" htmlFor="participant-email">
            E-Mail (optional)
          </label>
          <input
            id="participant-email"
            type="email"
            className="mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2 text-stone-900 shadow-sm"
            data-cy="email-input"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {serverError ? (
          <div
            className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
            data-cy="enroll-server-error"
          >
            {serverError}
            <div className="mt-2">
              <button
                type="button"
                className="rounded bg-red-800 px-3 py-1 text-sm font-medium text-white"
                data-cy="enroll-retry"
                onClick={() => setServerError(null)}
              >
                Erneut versuchen
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="submit"
          className="rounded bg-amber-700 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-amber-800 disabled:opacity-60"
          data-cy="submit"
          disabled={loading}
        >
          {loading ? "Wird gesendet…" : "Bescheinigung ausstellen"}
        </button>
      </form>
    </main>
  );
}

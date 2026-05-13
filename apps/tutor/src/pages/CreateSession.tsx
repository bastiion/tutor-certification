/**
 * Tutor "Sitzung erstellen" page.
 *
 * Reads the session inputs, calls the pure
 * {@link import("../lib/canonicalCredential.ts").buildCanonicalSessionCredential}
 * builder, posts the result to `${apiBaseUrl}/sessions`, and renders the
 * `enroll_url` returned by the backend with a copy-to-clipboard button.
 *
 * The QR rendering is intentionally **deferred to Stage 4** (see
 * `doc/implementation/2026-MM-DD-stage-3-tutor-sessions.md`).
 */

import { useEffect, useMemo, useState, type FormEvent } from "react";

const TUTOR_RECENTS_KEY = "tutor_recents_v1";
const TUTOR_EMAIL_SESSION_KEY = "tutorEmail";

function readStoredTutorEmail(): string {
  if (typeof window === "undefined") {
    return "";
  }
  try {
    const v = window.sessionStorage.getItem(TUTOR_EMAIL_SESSION_KEY);
    return typeof v === "string" ? v.trim() : "";
  } catch {
    return "";
  }
}

interface RecentSession {
  course_id: string;
  course_title: string;
  enroll_url: string;
  created_at: string;
}

function pushRecentSession(entry: RecentSession): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    const w = window;
    const prev = w.sessionStorage.getItem(TUTOR_RECENTS_KEY);
    const list: RecentSession[] = prev ? (JSON.parse(prev) as RecentSession[]) : [];
    const deduped = list.filter((x) => x.enroll_url !== entry.enroll_url);
    const next = [entry, ...deduped].slice(0, 5);
    w.sessionStorage.setItem(TUTOR_RECENTS_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

function readRecentSessions(): RecentSession[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.sessionStorage.getItem(TUTOR_RECENTS_KEY);
    if (raw === null) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as RecentSession[];
  } catch {
    return [];
  }
}
import { ready as cryptoReady } from "@bastiion/crypto";
import { Link } from "../Link.tsx";
import { useKeyVault } from "../KeyVault.tsx";
import { useServerConfig } from "../ServerConfig.tsx";
import {
  buildCanonicalSessionCredential,
  type SessionCredentialJson,
} from "../lib/canonicalCredential.ts";

interface CreateSessionResult {
  course_id: string;
  enroll_url: string;
  credential: SessionCredentialJson;
}

interface FormState {
  courseId: string;
  courseTitle: string;
  courseDate: string;
  instituteName: string;
  tutorEmail: string;
  validUntilLocal: string;
}

function defaultValidUntilLocal(now: Date = new Date()): string {
  const tomorrow = new Date(now.getTime());
  tomorrow.setDate(tomorrow.getDate() + 7);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(
    tomorrow.getDate(),
  )}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;
}

function defaultCourseDate(now: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function defaultCourseId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "00000000-0000-4000-8000-000000000000";
}

function localToUnixSeconds(local: string): number {
  const ms = new Date(local).getTime();
  if (!Number.isFinite(ms)) {
    throw new RangeError("Gültig-bis: ungültiges Datum/Uhrzeit");
  }
  return Math.floor(ms / 1000);
}

export function CreateSession() {
  const { snapshot, store } = useKeyVault();
  const { config, serverKey, refreshServerKey } = useServerConfig();
  const [form, setForm] = useState<FormState>(() => ({
    courseId: defaultCourseId(),
    courseTitle: "",
    courseDate: defaultCourseDate(),
    instituteName: "",
    tutorEmail: readStoredTutorEmail(),
    validUntilLocal: defaultValidUntilLocal(),
  }));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateSessionResult | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");
  const [recents, setRecents] = useState<RecentSession[]>(() => readRecentSessions());

  useEffect(() => {
    if (config !== null && serverKey.status === "idle") {
      void refreshServerKey();
    }
  }, [config, serverKey, refreshServerKey]);

  useEffect(() => {
    setRecents(readRecentSessions());
  }, [result]);

  const canSubmit = useMemo(
    () =>
      !submitting &&
      snapshot.hasSeed &&
      config !== null &&
      serverKey.status === "ready" &&
      form.courseId.trim() !== "" &&
      form.courseTitle.trim() !== "" &&
      form.instituteName.trim() !== "" &&
      form.tutorEmail.trim() !== "",
    [submitting, snapshot.hasSeed, config, serverKey, form],
  );

  function update<K extends keyof FormState>(key: K, value: FormState[K]): void {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setResult(null);
    setCopyState("idle");
    if (config === null || serverKey.status !== "ready") {
      setError("Server-Konfiguration unvollständig.");
      return;
    }
    if (!snapshot.hasSeed) {
      setError("Kein K_master geladen.");
      return;
    }
    setSubmitting(true);
    const seed = store.exportSeed();
    try {
      await cryptoReady();
      const credential = await buildCanonicalSessionCredential({
        courseId: form.courseId.trim(),
        validUntilUnix: localToUnixSeconds(form.validUntilLocal),
        courseTitle: form.courseTitle.trim(),
        courseDate: form.courseDate,
        instituteName: form.instituteName.trim(),
        tutorEmail: form.tutorEmail.trim(),
        kMasterSeed: seed,
        serverBoxPublicKey: serverKey.bytes,
      });

      const res = await fetch(`${config.apiBaseUrl}/sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.tutorApiToken}`,
        },
        body: JSON.stringify(credential),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        setError(
          `POST /sessions fehlgeschlagen (HTTP ${res.status})${text === "" ? "" : ": " + text.slice(0, 240)}`,
        );
        return;
      }

      const payload = (await res.json()) as { course_id?: string; enroll_url?: string };
      if (typeof payload.enroll_url !== "string" || typeof payload.course_id !== "string") {
        setError("Antwort enthielt kein enroll_url + course_id.");
        return;
      }

      setResult({
        course_id: payload.course_id,
        enroll_url: payload.enroll_url,
        credential,
      });
      pushRecentSession({
        course_id: payload.course_id,
        course_title: form.courseTitle.trim(),
        enroll_url: payload.enroll_url,
        created_at: new Date().toISOString(),
      });
      try {
        window.sessionStorage.setItem(TUTOR_EMAIL_SESSION_KEY, form.tutorEmail.trim());
      } catch {
        /* ignore storage */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler.");
    } finally {
      seed.fill(0);
      setSubmitting(false);
    }
  }

  async function handleCopy(): Promise<void> {
    if (result === null) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.enroll_url);
        setCopyState("copied");
        return;
      }
      throw new Error("Clipboard API nicht verfügbar");
    } catch {
      setCopyState("error");
    }
  }

  if (config === null) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10" data-cy="tutor-session-form">
        <h1 className="text-2xl font-semibold text-stone-900">Sitzung erstellen</h1>
        <p
          className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
          data-cy="server-config-missing"
        >
          Bitte zuerst die Server-Konfiguration (API-URL + Bearer-Token) im{" "}
          <Link to="home">Startbildschirm</Link> hinterlegen.
        </p>
      </div>
    );
  }

  if (serverKey.status === "error") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10" data-cy="tutor-session-form">
        <h1 className="text-2xl font-semibold text-stone-900">Sitzung erstellen</h1>
        <p
          className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          role="alert"
          data-cy="server-key-error"
        >
          Server-Schlüssel nicht erreichbar — {serverKey.message}
        </p>
        <button
          type="button"
          onClick={() => void refreshServerKey()}
          className="mt-3 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-sm font-medium text-stone-800"
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10" data-cy="tutor-session-form">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Sitzung erstellen</h1>
        <p className="mt-2 text-sm text-stone-600">
          Trage Kursdaten ein, signiere die Session-Credential mit K_master und erhalte
          den Einschreibe-Link für die Teilnehmer.
        </p>
      </header>

      {!snapshot.hasSeed ? (
        <p
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
          data-cy="session-no-key"
        >
          Es ist kein K_master geladen. Bitte zuerst{" "}
          <Link to="keys">Schlüssel verwalten</Link>.
        </p>
      ) : null}

      {recents.length > 0 ? (
        <aside
          className="mb-6 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
          data-cy="session-recents"
        >
          <h2 className="text-sm font-semibold text-stone-800">Letzte Sitzungen</h2>
          <ul className="mt-2 space-y-2 text-sm text-stone-700">
            {recents.map((r) => (
              <li key={r.enroll_url} className="border-b border-stone-100 pb-2 last:border-0">
                <div className="font-medium text-stone-900">{r.course_title}</div>
                <div className="font-mono text-xs text-stone-600 break-all">{r.enroll_url}</div>
                <div className="text-xs text-stone-500">{r.created_at}</div>
              </li>
            ))}
          </ul>
        </aside>
      ) : null}

      <form
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
        className="space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-sm"
      >
        <details
          data-cy="session-course-id-details"
          className="rounded-lg border border-stone-200 bg-stone-50/60 open:bg-white"
        >
          <summary
            data-cy="session-course-id-summary"
            className="cursor-pointer select-none list-none rounded-lg px-3 py-2 text-sm font-medium text-stone-700 outline-none ring-amber-600 hover:bg-stone-100 [&::-webkit-details-marker]:hidden focus-visible:ring-2"
          >
            <span className="block sm:inline">Kurs-ID (UUID)</span>
            <span className="mt-1 block font-mono text-xs font-normal text-stone-600 sm:mt-0 sm:ml-2 sm:inline">
              {form.courseId}
            </span>
            <span className="mt-0.5 block text-xs font-normal text-stone-500 sm:ml-2 sm:inline">
              — zum Bearbeiten aufklappen
            </span>
          </summary>
          <div className="border-t border-stone-200 px-3 pb-3 pt-3">
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-stone-700">
                Kurs-ID (UUID)
              </span>
              <input
                type="text"
                value={form.courseId}
                onChange={(e) => update("courseId", e.target.value)}
                data-cy="session-course-id"
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 font-mono text-sm shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
              />
            </label>
          </div>
        </details>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">Kurs-Titel</span>
          <input
            type="text"
            value={form.courseTitle}
            onChange={(e) => update("courseTitle", e.target.value)}
            data-cy="session-course-title"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700">Kurs-Datum</span>
            <input
              type="date"
              value={form.courseDate}
              onChange={(e) => update("courseDate", e.target.value)}
              data-cy="session-course-date"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-stone-700">Gültig bis</span>
            <input
              type="datetime-local"
              value={form.validUntilLocal}
              onChange={(e) => update("validUntilLocal", e.target.value)}
              data-cy="session-valid-until"
              className="w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">Institut</span>
          <input
            type="text"
            value={form.instituteName}
            onChange={(e) => update("instituteName", e.target.value)}
            data-cy="session-institute"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-stone-700">Tutor:in-E-Mail</span>
          <input
            type="email"
            value={form.tutorEmail}
            onChange={(e) => update("tutorEmail", e.target.value)}
            data-cy="session-tutor-email-input"
            className="w-full rounded-lg border border-stone-300 px-3 py-2 shadow-sm focus:border-amber-600 focus:outline-none focus:ring-1 focus:ring-amber-600"
          />
          <p className="mt-1 text-xs text-stone-500" data-cy="session-tutor-email-help">
            Als „An:“ für Ausstellungs- und Sperrmails. Unterscheidet sich die Server-Konfiguration
            (<code className="font-mono">TUTOR_EMAIL</code>), wird sie als Blindkopie ergänzt.
          </p>
        </label>

        {error ? (
          <p
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
            data-cy="session-error"
          >
            {error}
          </p>
        ) : null}

        <div>
          <button
            type="submit"
            disabled={!canSubmit}
            data-cy="session-submit"
            className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white shadow hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Wird erstellt …" : "Erstellen"}
          </button>
        </div>
      </form>

      {result ? (
        <section
          className="mt-6 space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm"
          data-cy="session-result"
        >
          <h2 className="text-base font-semibold text-emerald-900">Einschreibe-Link</h2>
          <p className="break-all rounded bg-white p-3 font-mono text-sm" data-cy="session-enroll-url">
            {result.enroll_url}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void handleCopy();
              }}
              className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              data-cy="session-copy"
            >
              Kopieren
            </button>
            {copyState === "copied" ? (
              <span className="text-sm text-emerald-800" data-cy="session-copied">
                Kopiert.
              </span>
            ) : null}
            {copyState === "error" ? (
              <span className="text-sm text-red-800" data-cy="session-copy-error">
                Konnte nicht in die Zwischenablage kopieren.
              </span>
            ) : null}
          </div>
          <p className="text-xs text-emerald-900/80" data-cy="session-qr-todo">
            QR-Code wird in Stage 4 ergänzt.
          </p>
        </section>
      ) : null}
    </div>
  );
}

export default CreateSession;

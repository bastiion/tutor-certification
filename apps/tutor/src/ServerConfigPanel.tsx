/**
 * Compact "Server konfigurieren" panel rendered at the top of every tutor
 * page. Lets the tutor enter the API base URL + bearer token once per browser
 * session; everything is stored only in `sessionStorage` (managed by
 * {@link useServerConfig}).
 */

import { useEffect, useState, type FormEvent } from "react";
import { defaultApiBaseUrl } from "./serverConfig.ts";
import { useServerConfig } from "./ServerConfig.tsx";

function browserOrigin(): string {
  if (typeof window !== "undefined" && typeof window.location !== "undefined") {
    return window.location.origin ?? "";
  }
  return "";
}

export function ServerConfigPanel() {
  const { config, serverKey, saveConfig, refreshServerKey } = useServerConfig();
  const [open, setOpen] = useState<boolean>(config === null);
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(
    config?.apiBaseUrl ?? defaultApiBaseUrl(browserOrigin()),
  );
  const [tutorApiToken, setTutorApiToken] = useState<string>(config?.tutorApiToken ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (config !== null) {
      setApiBaseUrl(config.apiBaseUrl);
      setTutorApiToken(config.tutorApiToken);
    }
  }, [config]);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    try {
      saveConfig({ apiBaseUrl, tutorApiToken });
      setError(null);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konfiguration ungültig.");
    }
  }

  const summary =
    config === null
      ? "nicht konfiguriert"
      : `${config.apiBaseUrl} · Token gesetzt`;

  return (
    <div
      className="border-b border-stone-200 bg-stone-50 text-sm text-stone-700"
      data-cy="server-config-panel"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <strong>Server:</strong>
          <span data-cy="server-config-summary">{summary}</span>
          <span
            className={
              serverKey.status === "ready"
                ? "text-emerald-700"
                : serverKey.status === "error"
                  ? "text-red-700"
                  : "text-stone-500"
            }
            data-cy="server-key-status"
          >
            {serverKey.status === "ready"
              ? "Schlüssel: ok"
              : serverKey.status === "loading"
                ? "Schlüssel: wird geladen …"
                : serverKey.status === "error"
                  ? `Schlüssel: ${serverKey.message}`
                  : "Schlüssel: noch nicht abgefragt"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          data-cy="server-config-toggle"
          className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs hover:bg-stone-100"
        >
          {open ? "schließen" : "Server konfigurieren"}
        </button>
      </div>

      {open ? (
        <form
          onSubmit={handleSubmit}
          className="mx-auto grid max-w-3xl gap-3 px-4 pb-3 sm:grid-cols-2"
          data-cy="server-config-form"
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-700">API-Basis-URL</span>
            <input
              type="text"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              data-cy="server-config-base-url"
              className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-stone-700">Tutor Bearer-Token</span>
            <input
              type="password"
              value={tutorApiToken}
              onChange={(e) => setTutorApiToken(e.target.value)}
              data-cy="server-config-token"
              className="w-full rounded border border-stone-300 px-2 py-1 text-sm"
            />
          </label>

          {error ? (
            <p
              className="sm:col-span-2 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800"
              role="alert"
              data-cy="server-config-error"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <button
              type="submit"
              data-cy="server-config-save"
              className="rounded bg-amber-700 px-3 py-1 text-xs font-medium text-white shadow hover:bg-amber-800"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={() => void refreshServerKey()}
              data-cy="server-config-refresh"
              className="rounded border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-800 shadow-sm hover:bg-stone-50"
            >
              Server-Schlüssel neu laden
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export default ServerConfigPanel;

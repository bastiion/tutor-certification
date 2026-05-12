/**
 * Stage 6 — tutor audit list, manual import, per-row revocation.
 */

import {
  useCallback,
  useMemo,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactElement,
} from "react";
import { Link } from "../Link.tsx";
import { useKeyVault } from "../KeyVault.tsx";
import { useServerConfig } from "../ServerConfig.tsx";
import {
  emptyAuditState,
  exportAuditState,
  importAuditState,
  markRevoked,
  sortedRows,
  upsertCertificate,
  type AuditState,
} from "../lib/auditStore.ts";
import { classifyTutorInboundFile, TUTOR_INBOUND_ACCEPT_ATTR } from "../lib/inboundMime.ts";
import { parseEmailAttachments } from "../lib/parseEmailAttachments.ts";
import { parseInboundJson } from "../lib/parseInboundJson.ts";
import { postRevocation } from "../lib/revoke.ts";
import { RevokeDialog } from "./RevokeDialog.tsx";

const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

export function Audit(): ReactElement {
  const { snapshot, store } = useKeyVault();
  const { config } = useServerConfig();
  const [audit, setAudit] = useState<AuditState>(() => emptyAuditState());
  const [error, setError] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"issued_desc" | "issued_asc">("issued_desc");
  const [filterCourse, setFilterCourse] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<"all" | "valid" | "revoked">("all");
  const [revokeTarget, setRevokeTarget] = useState<{ certId: string; name: string } | null>(null);
  const [revokeBusy, setRevokeBusy] = useState(false);

  const rows = useMemo(() => sortedRows(audit, sortOrder), [audit, sortOrder]);

  const courseOptions = useMemo(() => {
    const s = new Set<string>();
    for (const r of audit.rowsByCertId.values()) {
      s.add(r.certificate.course.title);
    }
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [audit]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (filterCourse !== "" && r.certificate.course.title !== filterCourse) return false;
      if (filterStatus === "valid" && r.revoked) return false;
      if (filterStatus === "revoked" && !r.revoked) return false;
      return true;
    });
  }, [rows, filterCourse, filterStatus]);

  const ingestTextPayloads = useCallback((payloads: string[], label: string) => {
    let added = 0;
    let skipped = 0;
    setAudit((prev) => {
      let next = prev;
      for (const raw of payloads) {
        const p = parseInboundJson(raw);
        if (!p.ok) {
          skipped += 1;
          continue;
        }
        next = upsertCertificate(next, p.raw, p.certificate);
        added += 1;
      }
      return next;
    });
    if (added === 0 && skipped > 0) {
      setError(`Keine gültige Bescheinigung in ${label}.`);
    } else if (skipped > 0) {
      setError(`${skipped} Eintrag/Datei in ${label} übersprungen (ungültig).`);
    } else {
      setError(null);
    }
  }, []);

  const processFile = useCallback(
    async (file: File) => {
      setError(null);
      if (file.size > MAX_IMPORT_BYTES) {
        setError("Datei zu groß (maximal 2 MB).");
        return;
      }
      const kind = classifyTutorInboundFile(file);
      if (kind === "unknown") {
        setError("Dateityp nicht unterstützt (nur JSON, EML oder MBOX).");
        return;
      }

      const text = await file.text();
      if (kind === "json") {
        ingestTextPayloads([text], file.name);
        return;
      }
      const rawCerts = parseEmailAttachments(text, kind === "mbox" ? "mbox" : "emailMessage");
      if (rawCerts.length === 0) {
        setError("Kein Zertifikats-JSON in der E-Mail-Datei gefunden.");
        return;
      }
      ingestTextPayloads(rawCerts, file.name);
    },
    [ingestTextPayloads],
  );

  const onFilesSelected = useCallback(
    (files: FileList | null) => {
      if (files === null) return;
      void (async () => {
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          if (f) {
            await processFile(f);
          }
        }
      })();
    },
    [processFile],
  );

  const handleExport = useCallback(() => {
    const json = exportAuditState(audit);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tutor-audit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [audit]);

  const handleImportAuditExport = useCallback((ev: ChangeEvent<HTMLInputElement>) => {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (f === undefined) return;
    void (async () => {
      try {
        const text = await f.text();
        const next = importAuditState(text);
        setAudit(next);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Import fehlgeschlagen.");
      }
    })();
  }, []);

  const handleRevokeConfirm = useCallback(
    async (reason: string) => {
      if (config === null || revokeTarget === null) return;
      if (!snapshot.hasSeed) {
        setError("Bitte zuerst K_master importieren.");
        return;
      }
      const revokedAt = new Date().toISOString();
      setRevokeBusy(true);
      const seed = store.exportSeed();
      try {
        const res = await postRevocation({
          apiBaseUrl: config.apiBaseUrl,
          bearerToken: config.tutorApiToken,
          certId: revokeTarget.certId,
          revokedAt,
          reason,
          kMasterSeed32: seed,
        });
        if (res.ok) {
          setAudit((prev) => markRevoked(prev, revokeTarget.certId, revokedAt, reason));
          setRevokeTarget(null);
          setError(null);
        } else {
          setError(res.message);
        }
      } finally {
        seed.fill(0);
        setRevokeBusy(false);
      }
    },
    [config, revokeTarget, snapshot.hasSeed, store],
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10" data-cy="tutor-audit">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">Audit & Widerruf</h1>
        <p className="mt-2 text-sm text-stone-600">
          Widerrufe sind signiert und erscheinen sofort in der{" "}
          <Link to="home" className="text-amber-700 underline">
            öffentlichen Prüfung
          </Link>
          .
        </p>
      </header>

      {config === null ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800" data-cy="audit-no-config">
          Bitte zuerst die Server-Konfiguration auf der Startseite hinterlegen.
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800">
          Zertifikate importieren
          <input
            type="file"
            multiple
            accept={TUTOR_INBOUND_ACCEPT_ATTR}
            className="sr-only"
            data-cy="import-input"
            onChange={(e) => {
              onFilesSelected(e.target.files);
            }}
          />
        </label>
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50">
          Audit-Liste importieren
          <input type="file" accept="application/json,.json" className="sr-only" data-cy="audit-rehydrate-input" onChange={handleImportAuditExport} />
        </label>
        <button
          type="button"
          className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-medium text-stone-800 hover:bg-stone-50"
          data-cy="audit-export"
          onClick={handleExport}
        >
          Audit exportieren
        </button>
      </div>

      <div
        className="mb-6 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-white px-6 py-8 text-center text-sm text-stone-600 hover:border-amber-400"
        data-cy="audit-drop-zone"
        onDragOver={(e: DragEvent) => {
          e.preventDefault();
        }}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          onFilesSelected(e.dataTransfer.files);
        }}
      >
        <span className="font-medium text-amber-900">Dateien hier ablegen</span>
        <span className="mt-1 text-xs text-stone-500">JSON, .eml oder .mbox</span>
      </div>

      {error ? (
        <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800" role="alert" data-cy="audit-error">
          {error}
        </p>
      ) : null}

      {!snapshot.hasSeed ? (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Kein K_master geladen —{" "}
          <Link to="keys" className="font-medium underline">
            Schlüssel verwalten
          </Link>
          .
        </p>
      ) : null}

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="block text-sm">
          <span className="font-medium text-stone-700">Kurs</span>
          <select
            value={filterCourse}
            onChange={(e) => {
              setFilterCourse(e.target.value);
            }}
            className="mt-1 block rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm"
            data-cy="audit-filter-course"
          >
            <option value="">Alle</option>
            {courseOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="text-sm">
          <legend className="font-medium text-stone-700">Status</legend>
          <div className="mt-1 flex gap-3">
            {(["all", "valid", "revoked"] as const).map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-1">
                <input
                  type="radio"
                  name="audit-status"
                  checked={filterStatus === v}
                  onChange={() => {
                    setFilterStatus(v);
                  }}
                  data-cy={`audit-filter-status-${v}`}
                />
                {v === "all" ? "Alle" : v === "valid" ? "Gültig" : "Widerrufen"}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm">
          <span className="font-medium text-stone-700">Sortierung</span>
          <select
            value={sortOrder}
            onChange={(e) => {
              setSortOrder(e.target.value as "issued_desc" | "issued_asc");
            }}
            className="mt-1 block rounded-lg border border-stone-300 bg-white px-2 py-1.5 text-sm"
            data-cy="audit-sort"
          >
            <option value="issued_desc">Ausstellung ↓</option>
            <option value="issued_asc">Ausstellung ↑</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wide text-stone-600">
            <tr>
              <th scope="col" className="px-3 py-2">
                Teilnehmer
              </th>
              <th scope="col" className="px-3 py-2">
                Kurs
              </th>
              <th scope="col" className="px-3 py-2">
                Ausgestellt
              </th>
              <th scope="col" className="px-3 py-2">
                Status
              </th>
              <th scope="col" className="px-3 py-2">
                Aktion
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-stone-500">
                  Noch keine Einträge — Dateien importieren.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.certId} className="border-t border-stone-100">
                  <td className="px-3 py-2">{r.certificate.participant.name}</td>
                  <td className="px-3 py-2">{r.certificate.course.title}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.certificate.issued_at}</td>
                  <td className="px-3 py-2">
                    <span data-cy={`row-status-${r.certId}`}>{r.revoked ? "widerrufen" : "gültig"}</span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={r.revoked || !snapshot.hasSeed}
                      title={r.revoked ? (r.revocationReason ?? "") : undefined}
                      aria-label={`Bescheinigung von ${r.certificate.participant.name} widerrufen`}
                      data-cy={`revoke-${r.certId}`}
                      className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
                      onClick={() => {
                        setRevokeTarget({ certId: r.certId, name: r.certificate.participant.name });
                      }}
                    >
                      Widerrufen
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <RevokeDialog
        open={revokeTarget !== null}
        participantName={revokeTarget?.name ?? ""}
        certId={revokeTarget?.certId ?? ""}
        submitting={revokeBusy}
        onClose={() => {
          if (!revokeBusy) setRevokeTarget(null);
        }}
        onConfirm={handleRevokeConfirm}
      />
    </div>
  );
}

export default Audit;

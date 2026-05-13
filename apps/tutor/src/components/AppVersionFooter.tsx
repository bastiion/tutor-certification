import { useEffect, useState, type ReactElement } from "react";

/**
 * One-shot `/api/health` probe for SPA footers (Stage 6b).
 * Parent should wrap with `no-print` for print shells.
 */

export function AppVersionFooter(): ReactElement {
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const [text, setText] = useState(
    origin === ""
      ? "Server-Version unbekannt"
      : `Server-Version unbekannt · Verbunden mit ${origin}`,
  );

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/health", { headers: { Accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: unknown) => {
        if (cancelled || typeof j !== "object" || j === null) return;
        const rec = j as { app_version?: unknown; schema_versions?: unknown };
        const appRaw = typeof rec.app_version === "string" ? rec.app_version.trim() : "";

        let certS = "?";
        let revS = "?";
        if (typeof rec.schema_versions === "object" && rec.schema_versions !== null) {
          const s = rec.schema_versions as { certificate?: unknown; revocation?: unknown };
          if (typeof s.certificate === "number") {
            certS = String(s.certificate);
          }
          if (typeof s.revocation === "number") {
            revS = String(s.revocation);
          }
        }

        const o = typeof window !== "undefined" ? window.location.origin : "";
        if (appRaw === "") {
          setText(`Server-Version unbekannt · Verbunden mit ${o}`);
          return;
        }
        setText(`Server v${appRaw} · Schema ${certS}/${revS} · Verbunden mit ${o}`);
      })
      .catch(() => {
        if (!cancelled) {
          const o = typeof window !== "undefined" ? window.location.origin : "";
          setText(`Server-Version unbekannt · Verbunden mit ${o}`);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <p data-cy="app-version-footer" className="text-xs text-stone-500">
      {text}
    </p>
  );
}

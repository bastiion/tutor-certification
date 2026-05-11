/**
 * Placeholder for the Stage 6 audit & revocation surface.
 *
 * Renders a friendly "coming later" panel so the navigation cards on the
 * home screen all resolve to a real page today.
 */

import { Link } from "../Link.tsx";

export function AuditPlaceholder() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10" data-cy="tutor-audit">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Audit & Widerruf
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Diese Ansicht wird in Stage 6 ergänzt.
        </p>
      </header>

      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-stone-700">
          In Stage 6 werden hier ausgestellte Bescheinigungen aus dem Tutor-Postfach
          eingelesen und einzeln widerrufen werden können (signiert mit dem K_master,
          den die <Link to="keys">Schlüssel-Ansicht</Link> verwaltet).
        </p>
      </div>
    </div>
  );
}

export default AuditPlaceholder;

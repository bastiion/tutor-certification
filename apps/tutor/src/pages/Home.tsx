/**
 * Tutor landing page — card grid linking to the Stage 3+ surfaces.
 *
 * Pure presentation. All navigation goes through the dependency-free `Link`
 * helper so we never trigger a full reload.
 */

import { Link } from "../Link.tsx";
import type { RouteId } from "../router.ts";

interface Card {
  to: RouteId;
  title: string;
  description: string;
  cta: string;
  cy: string;
}

const cards: Card[] = [
  {
    to: "sessions/new",
    title: "Sitzung erstellen",
    description:
      "Eine Kurs-Sitzung anlegen, Schlüssel ableiten und einen Einschreibe-Link generieren.",
    cta: "Sitzung anlegen",
    cy: "home-card-create-session",
  },
  {
    to: "keys",
    title: "Schlüssel verwalten",
    description: "K_master generieren oder importieren — bleibt ausschließlich im Browser-Tab.",
    cta: "Schlüssel öffnen",
    cy: "home-card-keys",
  },
  {
    to: "print",
    title: "Liste drucken",
    description:
      "Klassische Druck-Bescheinigungen aus einer Namensliste — wie zuvor, jetzt unter /tutor/print.",
    cta: "Drucken",
    cy: "home-card-print",
  },
  {
    to: "audit",
    title: "Audit & Widerruf",
    description: "Übersicht und Widerruf — wird in Stage 6 ergänzt.",
    cta: "Vorschau",
    cy: "home-card-audit",
  },
];

export function Home() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10" data-cy="tutor-home">
      <header className="mb-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Tutor-Konsole
        </h1>
        <p className="mt-2 text-sm text-stone-600">
          Schlüssel verwalten, Sitzungen anlegen, Bescheinigungen drucken — alles im Browser.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.to}
            className="flex flex-col rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
            data-cy={card.cy}
          >
            <h2 className="text-base font-semibold text-stone-800">{card.title}</h2>
            <p className="mt-2 flex-1 text-sm text-stone-600">{card.description}</p>
            <Link
              to={card.to}
              className="mt-4 inline-flex w-fit rounded-lg bg-amber-700 px-3 py-1.5 text-sm font-medium text-white shadow hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2"
            >
              {card.cta}
            </Link>
          </article>
        ))}
      </div>
    </div>
  );
}

export default Home;

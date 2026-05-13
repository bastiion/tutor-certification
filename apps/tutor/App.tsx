/**
 * Tutor SPA shell.
 *
 * Wraps the page tree in `KeyVaultProvider` + `ServerConfigProvider`, renders
 * the dependency-free `ServerConfigPanel` at the top, and switches between
 * pages based on the current path via `useRoute()`.
 *
 * The previous Stage 0 print form lives at `/tutor/print` (`PrintList`); the
 * existing Cypress spec was updated to that route.
 */

import "./index.css";
import { AppVersionFooter } from "./src/components/AppVersionFooter.tsx";
import { KeyVaultProvider } from "./src/KeyVault.tsx";
import { Link } from "./src/Link.tsx";
import { ServerConfigProvider } from "./src/ServerConfig.tsx";
import { ServerConfigPanel } from "./src/ServerConfigPanel.tsx";
import { Audit } from "./src/pages/Audit.tsx";
import { CreateSession } from "./src/pages/CreateSession.tsx";
import { Home } from "./src/pages/Home.tsx";
import { Keys } from "./src/pages/Keys.tsx";
import { PrintList } from "./src/pages/PrintList.tsx";
import { useRoute } from "./src/useRoute.ts";

function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10" data-cy="tutor-404">
      <h1 className="text-2xl font-semibold text-stone-900">Seite nicht gefunden</h1>
      <p className="mt-2 text-sm text-stone-600">
        Diese Adresse existiert in der Tutor-Konsole nicht.{" "}
        <Link to="home" className="text-amber-700 underline">
          Zur Startseite
        </Link>
      </p>
    </div>
  );
}

function CurrentPage() {
  const route = useRoute();
  switch (route) {
    case "home":
      return <Home />;
    case "keys":
      return <Keys />;
    case "sessions/new":
      return <CreateSession />;
    case "print":
      return <PrintList />;
    case "audit":
      return <Audit />;
    case "404":
      return <NotFound />;
  }
}

export function App() {
  return (
    <ServerConfigProvider>
      <KeyVaultProvider>
        <div className="app-root min-h-screen bg-stone-100 text-stone-900">
          <ServerConfigPanel />
          <CurrentPage />
          <footer className="no-print border-t border-stone-200 bg-stone-100 px-4 py-4 text-center">
            <AppVersionFooter />
          </footer>
        </div>
      </KeyVaultProvider>
    </ServerConfigProvider>
  );
}

export default App;

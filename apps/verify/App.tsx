import { cryptoPackageStatus } from "@ikwsd/crypto";
import "./index.css";

export function App() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-semibold text-stone-900">Zertifikat prüfen</h1>
      <p className="mt-3 text-stone-600">
        Scaffold für die zukünftige Verify-App unter <code className="rounded bg-stone-200 px-1">/verify/</code>.
      </p>
      <p className="mt-2 text-sm text-stone-500" data-cy="crypto-package-status">
        @ikwsd/crypto: {cryptoPackageStatus()}
      </p>
    </main>
  );
}

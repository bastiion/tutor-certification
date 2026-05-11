import { useEffect, useState } from "react";
import { cryptoPackageStatus, ready, type PackageStatus } from "@bastiion/crypto";
import "./index.css";

export function App() {
  const [status, setStatus] = useState<PackageStatus | null>(null);
  useEffect(() => {
    void ready().then(() => setStatus(cryptoPackageStatus()));
  }, []);

  const cryptoLine = status
    ? `@bastiion/crypto: ready (sodium ${status.sodiumVersion})`
    : "@bastiion/crypto: initialising…";

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-xl font-semibold text-stone-900">Teilnahme — Anmeldung</h1>
      <p className="mt-3 text-stone-600">
        Scaffold für die zukünftige Enrollment-App unter <code className="rounded bg-stone-200 px-1">/enroll/</code>.
      </p>
      <p className="mt-2 text-sm text-stone-500" data-cy="crypto-package-status">
        {cryptoLine}
      </p>
    </main>
  );
}

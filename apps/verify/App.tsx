import { useEffect, useState, type ReactElement } from "react";
import { cryptoPackageStatus, ready, type PackageStatus } from "@bastiion/crypto";
import "./index.css";
import { useVerifyRoute } from "./src/useVerifyRoute.ts";
import { VerifyById } from "./src/pages/VerifyById.tsx";
import { VerifyDrop } from "./src/pages/VerifyDrop.tsx";

export function App(): ReactElement {
  const route = useVerifyRoute();
  const [status, setStatus] = useState<PackageStatus | null>(null);

  useEffect(() => {
    void ready().then(() => setStatus(cryptoPackageStatus()));
  }, []);

  const cryptoLine = status
    ? `@bastiion/crypto: ready (sodium ${status.sodiumVersion})`
    : "@bastiion/crypto: initialising…";

  let body: ReactElement;
  if (route.kind === "by-id") {
    body = <VerifyById certId={route.certId} />;
  } else {
    body = <VerifyDrop />;
  }

  return (
    <div data-cy="verify-root" className="min-h-screen">
      {body}
      <footer className="no-print mx-auto max-w-xl px-8 pb-6 text-center text-xs text-stone-400">
        <p data-cy="crypto-package-status">{cryptoLine}</p>
      </footer>
    </div>
  );
}

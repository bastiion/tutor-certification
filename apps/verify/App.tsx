import { useEffect, useState, type ReactElement } from "react";
import { cryptoPackageStatus, ready, type PackageStatus } from "@bastiion/crypto";
import "./index.css";
import { AppVersionFooter } from "./src/components/AppVersionFooter.tsx";
import { rawCertificateJsonFromQrPayload } from "./src/lib/enrollmentQrPayload.ts";
import { VerifyById } from "./src/pages/VerifyById.tsx";
import { VerifyDrop } from "./src/pages/VerifyDrop.tsx";
import { useVerifyRoute } from "./src/useVerifyRoute.ts";

type DirectOpenBootstrap = { decoded: string | null };

/** `/verify/#cert=` direct-open: capture once per full page load (StrictMode-safe). */
let directOpenCertBootstrap: DirectOpenBootstrap | undefined;

function readDirectOpenCertBootstrap(): string | null {
  if (directOpenCertBootstrap !== undefined) {
    return directOpenCertBootstrap.decoded;
  }

  directOpenCertBootstrap = { decoded: null };
  if (typeof window === "undefined") {
    return null;
  }
  const h = window.location.hash.trim();
  if (!h.startsWith("#cert=")) {
    return null;
  }
  try {
    const decoded = rawCertificateJsonFromQrPayload(h);
    const pathOnly = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", pathOnly);
    directOpenCertBootstrap = { decoded };
    return decoded;
  } catch {
    return null;
  }
}

export function App(): ReactElement {
  const route = useVerifyRoute();
  const [status, setStatus] = useState<PackageStatus | null>(null);
  const [bootstrapJson] = useState(readDirectOpenCertBootstrap);

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
    body = <VerifyDrop initialCertificateJson={bootstrapJson} />;
  }

  return (
    <div data-cy="verify-root" className="min-h-screen">
      {body}
      <footer className="no-print mx-auto max-w-xl space-y-1 px-8 pb-6 text-center text-xs text-stone-400">
        <AppVersionFooter />
        <p data-cy="crypto-package-status">{cryptoLine}</p>
      </footer>
    </div>
  );
}

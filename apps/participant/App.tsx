import { useEffect, useState, type ReactElement } from "react";
import { cryptoPackageStatus, ready, type PackageStatus } from "@bastiion/crypto";
import "./index.css";
import { useParticipantRoute } from "./src/useParticipantRoute.ts";
import { CertView } from "./src/pages/CertView.tsx";
import { EnrollForm } from "./src/pages/EnrollForm.tsx";
import { Expired } from "./src/pages/Expired.tsx";

export function App() {
  const route = useParticipantRoute();
  const [issuedRawBody, setIssuedRawBody] = useState<string | null>(null);
  const [status, setStatus] = useState<PackageStatus | null>(null);

  useEffect(() => {
    void ready().then(() => setStatus(cryptoPackageStatus()));
  }, []);

  useEffect(() => {
    setIssuedRawBody(null);
  }, [route]);

  const cryptoLine = status
    ? `@bastiion/crypto: ready (sodium ${status.sodiumVersion})`
    : "@bastiion/crypto: initialising…";

  let body: ReactElement;
  if (issuedRawBody) {
    body = <CertView rawBody={issuedRawBody} />;
  } else if (route.kind === "expired-page") {
    body = <Expired variant="closed" />;
  } else if (route.kind === "bad-enroll-url") {
    body = <Expired variant="invalid-url" />;
  } else {
    body = <EnrollForm token={route.token} onIssued={setIssuedRawBody} />;
  }

  return (
    <div data-cy="enroll-root" className="min-h-screen">
      {body}
      <footer className="no-print mx-auto max-w-xl px-8 pb-6 text-center text-xs text-stone-400">
        <p data-cy="crypto-package-status">{cryptoLine}</p>
      </footer>
    </div>
  );
}

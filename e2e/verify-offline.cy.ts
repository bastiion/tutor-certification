/// <reference types="cypress" />

import type { MintSessionCredentialResult, SignRevocationResult } from "./support/tasks/apiCryptoTasks";

describe("verify SPA — offline drop (compose stack)", () => {
  it("drop valid JSON; tamper signatures + fingerprint; revoke with offline revocation check", () => {
    const bearer = Cypress.env("TUTOR_API_TOKEN") as string | undefined;
    expect(bearer, "TUTOR_API_TOKEN").to.be.a("string").and.not.be.empty;

    const apiOrigin = Cypress.config("baseUrl") ?? "http://localhost:7123";

    cy.task<MintSessionCredentialResult>("mintSessionCredential", {}).then((pack) => {
      cy.request({
        method: "POST",
        url: "/api/sessions",
        headers: { Authorization: `Bearer ${bearer}` },
        body: pack.credential,
      }).then((sessionRes) => {
        expect(sessionRes.status).to.eq(200);
        const enrollUrl = sessionRes.body.enroll_url as string;
        const pathname = new URL(enrollUrl, apiOrigin).pathname;
        const tokenMatch = pathname.match(/\/enroll\/(.+)$/);
        expect(tokenMatch?.[1], "enroll token segment present").to.be.ok;
        const tokenOpaque = decodeURIComponent(tokenMatch![1]);

        const enrollApiUrl = new URL(`/api/enroll/${encodeURIComponent(tokenOpaque)}`, String(apiOrigin)).toString();

        cy.wrap(
          fetch(enrollApiUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ name: "Verify Offline E2E" }),
          }).then(async (r) => {
            const raw = await r.text();
            expect(r.ok).to.eq(true);
            return raw;
          }),
        ).then((rawBody) => {
          const certId = (JSON.parse(rawBody) as { cert_id: string }).cert_id;

          cy.visit("/verify/");
          cy.writeFile("e2e/.tmp-verify-cert.json", rawBody);
          cy.get("[data-cy=drop-zone] input[type=file]").selectFile("e2e/.tmp-verify-cert.json", { force: true });
          cy.get("[data-cy=status-valid]").should("be.visible");
          cy.get("[data-cy=chip-online-no-revocation]").should("be.visible");

          cy.task("writeEnrollmentQrPng", {
            rawCertJson: rawBody,
            outPath: "e2e/.tmp-verify-qr.png",
          });
          cy.get("[data-cy=drop-zone] input[type=file]").selectFile("e2e/.tmp-verify-qr.png", { force: true });
          cy.get("[data-cy=status-valid]").should("be.visible");

          const flipFirstSigChar = (field: "certificate_sig" | "session_sig", raw: string): string => {
            const re =
              field === "certificate_sig"
                ? /("certificate_sig":")([A-Za-z0-9_-]+)(")/
                : /("session_sig":")([A-Za-z0-9_-]+)(")/;
            const m = re.exec(raw);
            expect(m?.[2], `${field} capture`).to.be.ok;
            const sig = m![2]!;
            const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
            return raw.replace(re, `$1${flipped}$3`);
          };

          cy.writeFile("e2e/.tmp-tampered-cert.json", flipFirstSigChar("certificate_sig", rawBody));
          cy.get("[data-cy=drop-zone] input[type=file]").selectFile("e2e/.tmp-tampered-cert.json", { force: true });
          cy.get("[data-cy=status-tampered][data-tampered-reason=certificate_sig]").should("be.visible");

          cy.writeFile("e2e/.tmp-tampered-session.json", flipFirstSigChar("session_sig", rawBody));
          cy.get("[data-cy=drop-zone] input[type=file]").selectFile("e2e/.tmp-tampered-session.json", { force: true });
          cy.get("[data-cy=status-tampered][data-tampered-reason=session_sig]").should("be.visible");

          const badFingerprint = `${"0".repeat(63)}f`;
          const fpTampered = rawBody.replace(/("key_fingerprint":")[^"]*(")/, `$1${badFingerprint}$2`);
          cy.writeFile("e2e/.tmp-tampered-fp.json", fpTampered);
          cy.get("[data-cy=drop-zone] input[type=file]").selectFile("e2e/.tmp-tampered-fp.json", {
            force: true,
          });
          cy.get("[data-cy=status-tampered][data-tampered-reason=fingerprint_mismatch]").should("be.visible");

          const revokedAt = "2026-05-11T16:00:00.000Z";
          cy.task<SignRevocationResult>("signRevocationDocument", {
            certId,
            revokedAt,
            masterSecretKey64B64: pack.masterSecretKey64B64,
          }).then((signed) => {
            cy.request({
              method: "POST",
              url: "/api/revocations",
              headers: { Authorization: `Bearer ${bearer}` },
              body: {
                cert_id: certId,
                revoked_at: revokedAt,
                reason: "cypress verify-offline",
                signature: signed.signature,
              },
            }).then((revRes) => {
              expect(revRes.status).to.eq(200);

              cy.visit("/verify/");
              cy.writeFile("e2e/.tmp-revoked-cert.json", rawBody);
              cy.get("[data-cy=drop-zone] input[type=file]").selectFile("e2e/.tmp-revoked-cert.json", {
                force: true,
              });
              cy.get("[data-cy=status-revoked]").should("be.visible");
              cy.get("[data-cy=revocation-offline-verified]").should("be.visible");
              cy.get("[data-cy=revocation-not-offline-verified]").should("not.exist");
            });
          });
        });
      });
    });
  });
});

/// <reference types="cypress" />

import type { MintSessionCredentialResult, SignRevocationResult } from "./support/tasks/apiCryptoTasks";

describe("verify SPA — online id-only (compose stack)", () => {
  it("id-only: no revocation → unknown; after revoke → revoked + caveat; bad id → unknown", () => {
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

        const enrollUrlFull = new URL(`/api/enroll/${encodeURIComponent(tokenOpaque)}`, String(apiOrigin)).toString();

        cy.wrap(
          fetch(enrollUrlFull, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ name: "Verify Online E2E" }),
          }).then(async (r) => {
            const text = await r.text();
            expect(r.ok).to.eq(true);
            return (JSON.parse(text) as { cert_id: string }).cert_id;
          }),
        ).then((certId) => {
          cy.visit(`/verify/${certId}`);
          cy.get("[data-cy=status-unknown][data-unknown-reason=no_offline_doc]").should("be.visible");

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
                schema_version: 1,
                cert_id: certId,
                revoked_at: revokedAt,
                reason: "cypress verify-online",
                signature: signed.signature,
              },
            }).then((revRes) => {
              expect(revRes.status).to.eq(200);

              cy.visit(`/verify/${certId}`);
              cy.get("[data-cy=status-revoked]").should("be.visible");
              cy.get("[data-cy=revocation-not-offline-verified]").should("be.visible");

              cy.visit("/verify/%09%20%0A");
              cy.get("[data-cy=status-unknown][data-unknown-reason=id_unknown]").should("be.visible");
            });
          });
        });
      });
    });
  });
});

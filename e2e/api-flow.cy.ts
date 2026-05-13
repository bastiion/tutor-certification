/// <reference types="cypress" />

import type { MintSessionCredentialResult, SignRevocationResult } from "./support/tasks/apiCryptoTasks";
import { mailpitBaseUrl, waitForMailpitSubject } from "./support/mailpit";

describe("backend API flow (docker compose)", () => {
  it("full tutor → participant → verify → openapi → revoke chain + tutor mail", () => {
    const bearer = Cypress.env("TUTOR_API_TOKEN") as string | undefined;
    expect(
      bearer,
      "set TUTOR_API_TOKEN (cypress:compose sources docker/php/dev.env)",
    )
      .to.be.a("string")
      .and.not.be.empty;

    cy.request({ method: "DELETE", url: `${mailpitBaseUrl()}/api/v1/messages`, failOnStatusCode: false });

    cy.task<MintSessionCredentialResult>("mintSessionCredential", {}).then((pack) => {
      cy.request({
        method: "POST",
        url: "/api/sessions",
        headers: { Authorization: `Bearer ${bearer}` },
        body: pack.credential,
      }).then((sessionRes) => {
        expect(sessionRes.status).to.eq(200);
        const enrollUrl = sessionRes.body.enroll_url as string;
        const apiOrigin = Cypress.config("baseUrl") ?? "http://localhost:7123";
        const pathname = new URL(enrollUrl, apiOrigin).pathname;
        const tokenMatch = pathname.match(/\/enroll\/(.+)$/);
        expect(tokenMatch?.[1], "enroll token segment present").to.be.ok;
        const tokenOpaque = decodeURIComponent(tokenMatch![1]);

        cy.request({
          method: "POST",
          url: `/api/enroll/${encodeURIComponent(tokenOpaque)}`,
          body: { name: "Compose E2E" },
        }).then((enrollRes) => {
          expect(enrollRes.status).to.eq(200);
          const certId = enrollRes.body.cert_id as string;

          cy.request("GET", `/api/verify/${certId}`).then((v1) => {
            expect(v1.status).to.eq(200);
            expect(v1.body.valid).to.eq(true);
          });

          cy.request("GET", "/api/openapi.json").then((spec) => {
            expect(spec.status).to.eq(200);
            const cc = spec.headers["cache-control"] ?? spec.headers["Cache-Control"];
            expect(cc).to.match(/no-store/);
            expect(spec.body).to.have.property("openapi");
          });

          waitForMailpitSubject("Neue Teilnahmebescheinigung ausgestellt");

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
                reason: "cypress api-flow",
                signature: signed.signature,
              },
            }).then((revRes) => {
              expect(revRes.status).to.eq(200);
            });

            cy.request("GET", `/api/verify/${certId}`).then((v2) => {
              expect(v2.status).to.eq(200);
              expect(v2.body.valid).to.eq(false);
              expect(v2.body.revocation_doc.cert_id).to.eq(certId);
            });
          });
        });
      });
    });
  });
});

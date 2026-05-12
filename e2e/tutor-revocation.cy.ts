/// <reference types="cypress" />

import type {
  EnrollAsResult,
  MintSessionCredentialResult,
} from "./support/tasks/apiCryptoTasks";

const STORAGE_KEY_PREFIX = "serverConfig:";

function apiBaseUrl(): string {
  const baseUrl = Cypress.config("baseUrl") ?? "http://localhost:7123";
  return `${baseUrl.replace(/\/+$/, "")}/api`;
}

/** Must match {@link ../apps/tutor/src/lib/e2eKeyPrefill.ts}. */
const E2E_KM_B64URL_KEY = "tutor_e2e_km_b64url";

describe("tutor — audit import + revoke (compose stack)", () => {
  it("imports cert, revokes with reason, verify page shows revoked; revoke button disabled after", () => {
    const bearer = Cypress.env("TUTOR_API_TOKEN") as string | undefined;
    expect(bearer, "TUTOR_API_TOKEN").to.be.a("string").and.not.be.empty;

    const origin = Cypress.config("baseUrl") ?? "http://localhost:7123";
    const api = apiBaseUrl();

    cy.intercept("POST", "**/api/revocations", (req) => {
      req.continue();
    }).as("postRevocation");

    cy.task<MintSessionCredentialResult>("mintSessionCredential", {}).then((pack) => {
      cy.request({
        method: "POST",
        url: "/api/sessions",
        headers: { Authorization: `Bearer ${bearer}` },
        body: pack.credential,
      }).then((sessionRes) => {
        expect(sessionRes.status).to.eq(200);
        const enrollUrl = sessionRes.body.enroll_url as string;

        cy.task<EnrollAsResult>("enrollAs", {
          enrollUrl,
          apiOrigin: String(origin),
          name: "Tutor Revoke E2E",
        }).then(({ certId, certJSON }) => {
          cy.visit("/tutor/audit", {
            onBeforeLoad(win) {
              win.sessionStorage.setItem(
                `${STORAGE_KEY_PREFIX}${api}`,
                JSON.stringify({ apiBaseUrl: api, tutorApiToken: bearer }),
              );
              win.sessionStorage.setItem(E2E_KM_B64URL_KEY, pack.masterSeedBase64Url);
            },
          });

          cy.writeFile("e2e/.tmp-tutor-audit-cert.json", certJSON);
          cy.get("[data-cy=import-input]").selectFile("e2e/.tmp-tutor-audit-cert.json", { force: true });
          cy.get(`[data-cy=row-status-${certId}]`).should("contain.text", "gültig");

          cy.get(`[data-cy=revoke-${certId}]`, { timeout: 15_000 }).should("not.be.disabled");

          cy.get(`[data-cy=revoke-${certId}]`).click();
          cy.get("[data-cy=revoke-reason]").type("cypress tutor-revocation");
          cy.get("[data-cy=revoke-confirm]").click();

          cy.wait("@postRevocation");
          cy.get("@postRevocation.all").its("length").should("eq", 1);

          cy.get(`[data-cy=row-status-${certId}]`).should("contain.text", "widerrufen");
          cy.get(`[data-cy=revoke-${certId}]`).should("be.disabled");

          cy.visit(`/verify/${certId}`);
          cy.get("[data-cy=status-revoked]").should("be.visible");
        });
      });
    });
  });
});

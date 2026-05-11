/// <reference types="cypress" />

/**
 * Stage 3 — tutor key onboarding + session creation.
 *
 * Drives the new tutor SPA end to end against the running compose stack:
 *   1. pre-seed `sessionStorage` with API base URL + bearer token,
 *   2. visit `/tutor/keys`, generate K_master,
 *   3. SPA-navigate (no reload, so the in-memory key survives) to
 *      `/tutor/sessions/new`, fill the form, submit,
 *   4. confirm the enrollment URL panel + copy button render,
 *   5. parse the URL and assert it points at `/enroll/<token>` on the API
 *      origin (Stage 4 will assert the participant page contents).
 */

const API_BASE_DEFAULT = "/api";
const STORAGE_KEY_PREFIX = "serverConfig:";

function apiBaseUrl(): string {
  const baseUrl = Cypress.config("baseUrl") ?? "http://localhost:7123";
  // Strip trailing slash so the SPA's serverConfig canonicalisation matches our preseed key.
  return `${baseUrl.replace(/\/+$/, "")}${API_BASE_DEFAULT}`;
}

function preseedServerConfig(token: string): void {
  const base = apiBaseUrl();
  cy.window().then((win) => {
    win.sessionStorage.setItem(
      `${STORAGE_KEY_PREFIX}${base}`,
      JSON.stringify({ apiBaseUrl: base, tutorApiToken: token }),
    );
  });
}

describe("tutor: key onboarding + session creation", () => {
  beforeEach(() => {
    const bearer = Cypress.env("TUTOR_API_TOKEN") as string | undefined;
    expect(
      bearer,
      "set TUTOR_API_TOKEN (cypress:compose sources docker/php/dev.env)",
    )
      .to.be.a("string")
      .and.not.be.empty;
  });

  it("generates K_master, creates a session, surfaces a copyable enroll URL", () => {
    const bearer = Cypress.env("TUTOR_API_TOKEN") as string;

    cy.visit("/tutor/keys");
    preseedServerConfig(bearer);
    cy.reload();

    // Key onboarding -------------------------------------------------------
    cy.get("[data-cy=keys-empty]").should("exist");
    cy.get("[data-cy=keys-generate]").click();
    cy.get("[data-cy=keys-loaded]").should("exist");
    cy.get("[data-cy=keys-fingerprint-full]")
      .invoke("text")
      .should("match", /^[a-f0-9]{64}$/);

    // SPA navigation preserves the in-memory K_master ---------------------
    cy.contains("a", "Weiter zu „Sitzung erstellen“").click();
    cy.location("pathname").should("eq", "/tutor/sessions/new");

    // Wait for the server X25519 key fetch to land before submitting.
    cy.get("[data-cy=server-key-status]", { timeout: 15_000 }).should(
      "contain.text",
      "ok",
    );

    const courseId = `e2e-stage3-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    cy.get("[data-cy=session-course-id-summary]").click();
    cy.get("[data-cy=session-course-id]").should("be.visible").clear().type(courseId);
    cy.get("[data-cy=session-course-title]").clear().type("Stage 3 E2E Kurs");
    cy.get("[data-cy=session-institute]").clear().type("Example Institute");
    cy.get("[data-cy=session-email]").clear().type("tutor@example.test");

    cy.get("[data-cy=session-submit]").should("not.be.disabled").click();

    // Result panel --------------------------------------------------------
    cy.get("[data-cy=session-result]", { timeout: 15_000 }).should("be.visible");
    cy.contains("button", "Kopieren").should("be.visible");
    cy.get("[data-cy=session-qr-todo]").should("contain.text", "Stage 4");

    cy.get("[data-cy=session-enroll-url]")
      .invoke("text")
      .then((enrollUrlRaw) => {
        const enrollUrl = enrollUrlRaw.trim();
        expect(enrollUrl).to.be.a("string").and.not.be.empty;
        const apiOrigin = Cypress.config("baseUrl") ?? "http://localhost:7123";
        const parsed = new URL(enrollUrl, apiOrigin);
        expect(parsed.pathname.startsWith("/enroll/")).to.eq(true);
        const token = decodeURIComponent(parsed.pathname.slice("/enroll/".length));
        expect(token, "enroll token segment present").to.have.length.greaterThan(8);
      });
  });
});

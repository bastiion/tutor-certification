/// <reference types="cypress" />

import type { MintSessionCredentialResult } from "./support/tasks/apiCryptoTasks";
import { mailpitBaseUrl, waitForMailpitSubject } from "./support/mailpit";

function jsonLowerIncludesEmail(hay: unknown, email: string): boolean {
  return JSON.stringify(hay ?? [])
    .toLowerCase()
    .includes(email.trim().toLowerCase());
}

/** Full enrollment JSON makes `#cert=` URLs impractically long for Cypress/Electron; drop-zone covers the same verify pipeline. */
const VERIFY_DROP_VALID_MS = 25_000;

describe("participant enrollment (compose stack)", () => {
  it("issues a certificate with QR, download, print hook, and emails the tutor", () => {
    const bearer = Cypress.env("TUTOR_API_TOKEN") as string | undefined;
    const tutorEmail = Cypress.env("TUTOR_EMAIL") as string | undefined;
    expect(bearer, "TUTOR_API_TOKEN from docker/php/dev.env").to.be.a("string").and.not.be.empty;
    expect(tutorEmail, "TUTOR_EMAIL from docker/php/dev.env").to.be.a("string").and.not.be.empty;

    cy.request({ method: "DELETE", url: `${mailpitBaseUrl()}/api/v1/messages`, failOnStatusCode: false });

    cy.intercept("POST", "**/api/enroll/**").as("postEnroll");

    cy.task<MintSessionCredentialResult>("mintSessionCredential", {}).then((pack) => {
      cy.request({
        method: "POST",
        url: "/api/sessions",
        headers: { Authorization: `Bearer ${bearer}` },
        body: pack.credential,
      }).then((sessionRes) => {
        expect(sessionRes.status).to.eq(200);
        const enrollUrl = sessionRes.body.enroll_url as string;
        cy.visit(enrollUrl);
        cy.get("[data-cy=name-input]").type("Erika Musterfrau");
        cy.get("[data-cy=submit]").click();
        cy.wait("@postEnroll").then((intercept) => {
          const rb = intercept.response?.body;
          const certJsonRaw =
            typeof rb === "string" ? rb : rb !== undefined ? JSON.stringify(rb) : "";
          expect(certJsonRaw, "enrollment response body").not.to.eq("");
          const certObj = JSON.parse(certJsonRaw) as { cert_id?: string };
          expect(certObj.cert_id, "cert_id").to.be.a("string");
          cy.wrap(certJsonRaw, { log: false }).as("issuedCertRaw");
          cy.wrap(certObj.cert_id!, { log: false }).as("issuedCertId");
        });

        cy.get("[data-cy=certificate-name]").should("include.text", "Erika Musterfrau");

        cy.get("@issuedCertId").then((certIdWrap) => {
          const cid = certIdWrap as unknown as string;
          cy.get("[data-cy=certificate-verify-caption]")
            .should("be.visible")
            .invoke("text")
            .should("include", `/verify/${cid}`);
        });

        cy.get("[data-cy=app-version-footer]").invoke("text").should("match", /Server v/);

        cy.get("[data-cy=certificate-qr] svg")
          .should("be.visible")
          .then(($svg) => {
            expect($svg.width(), "QR svg width").to.be.greaterThan(100);
          });

        cy.get("[data-cy=download-json]")
          .should("have.attr", "href")
          .then((hrefAttr) => {
            const href = hrefAttr as string;
            expect(href).to.match(/^data:application\/json/);
            const parsed = /^data:application\/json[^,]*,(.+)$/.exec(href);
            expect(parsed?.[1], "data URL payload group").to.be.ok;
            const jsonText = decodeURIComponent(parsed![1]!);
            const obj = JSON.parse(jsonText) as { participant?: { name?: string } };
            expect(obj.participant?.name).to.eq("Erika Musterfrau");
          });

        cy.window().then((w) => {
          cy.stub(w, "print").as("winPrint");
        });
        cy.get("[data-cy=print]").click();
        cy.get("@winPrint").should("have.been.calledOnce");

        waitForMailpitSubject("Neue Teilnahmebescheinigung ausgestellt");

        cy.get("@issuedCertRaw").then((rawWrap) => {
          cy.get("@issuedCertId").then((idWrap) => {
            const raw = rawWrap as unknown as string;
            const cid = idWrap as unknown as string;
            cy.request("GET", `/api/verify/${encodeURIComponent(cid)}`).then((probe) => {
              expect(probe.status, "certificate visible to verifier API").to.eq(200);
              expect(probe.body.valid).to.eq(true);
            });
            cy.writeFile("e2e/.tmp-participant-enrolled-cert.json", raw);
            cy.visit("/verify/");
            cy.get("[data-cy=verify-root]", { timeout: VERIFY_DROP_VALID_MS }).should("be.visible");
            cy.get("[data-cy=drop-zone] input[type=file]").selectFile("e2e/.tmp-participant-enrolled-cert.json", {
              force: true,
            });
            cy.get("[data-cy=status-valid]", { timeout: VERIFY_DROP_VALID_MS }).should("be.visible");
            cy.get("[data-cy=chip-online-no-revocation]").should("be.visible");
            cy.get("[data-cy=app-version-footer]", { timeout: VERIFY_DROP_VALID_MS })
              .invoke("text")
              .should("match", /Schema/);
          });
        });

        cy.request("GET", `${mailpitBaseUrl()}/api/v1/messages`).then((listRes) => {
          expect(listRes.status).to.eq(200);
          const messages = (
            listRes.body as { messages?: Array<{ ID: string; Subject: string; To?: unknown; Bcc?: unknown }> }
          ).messages ?? [];
          const hit = messages.find(
            (m) =>
              m.Subject === "Neue Teilnahmebescheinigung ausgestellt" &&
              jsonLowerIncludesEmail(m.To ?? [], "session-owner@example.test"),
          );
          expect(hit, "Mailpit message to tutor").to.exist;

          cy.request("GET", `${mailpitBaseUrl()}/api/v1/message/${hit!.ID}`).then((detailRes) => {
            expect(detailRes.status).to.eq(200);
            const detail = detailRes.body as {
              Attachments?: Array<{ FileName?: string }>;
              To?: unknown;
              Bcc?: unknown;
            };
            expect(jsonLowerIncludesEmail(detail.To, "session-owner@example.test"), "SMTP To primary").to.eq(true);
            expect(jsonLowerIncludesEmail(detail.Bcc, tutorEmail!), "SMTP BCC backup").to.eq(true);
            expect(
              jsonLowerIncludesEmail(detail.Bcc, "session-owner@example.test"),
              "BCC must not duplicate session tutor",
            ).to.eq(false);

            const attachments = detail.Attachments ?? [];
            expect(attachments.length, "at least one attachment").to.be.greaterThan(0);
            expect(
              attachments.some(
                (a) => typeof a.FileName === "string" && /\.cert\.json$/i.test(a.FileName),
              ),
              ".cert.json attachment",
            ).to.eq(true);
          });
        });
      });
    });
  });

  it("does not add BCC when session tutor inbox matches TUTOR_EMAIL (case-insensitive)", () => {
    const bearer = Cypress.env("TUTOR_API_TOKEN") as string | undefined;
    const tutorEmail = Cypress.env("TUTOR_EMAIL") as string | undefined;
    expect(bearer).to.be.a("string").and.not.be.empty;
    expect(tutorEmail).to.be.a("string").and.not.be.empty;

    cy.request({ method: "DELETE", url: `${mailpitBaseUrl()}/api/v1/messages`, failOnStatusCode: false });

    cy.task<MintSessionCredentialResult>(
      "mintSessionCredential",
      { tutorEmail: "TUTOR@EXAMPLE.TEST" },
    ).then((pack) => {
      cy.request({
        method: "POST",
        url: "/api/sessions",
        headers: { Authorization: `Bearer ${bearer}` },
        body: pack.credential,
      }).then((sessionRes) => {
        expect(sessionRes.status).to.eq(200);
        const enrollUrl = sessionRes.body.enroll_url as string;
        cy.visit(enrollUrl);
        cy.get("[data-cy=name-input]").type("Case Match E2E");
        cy.get("[data-cy=submit]").click();
        cy.get("[data-cy=certificate-name]", { timeout: 20_000 }).should("include.text", "Case Match E2E");

        waitForMailpitSubject("Neue Teilnahmebescheinigung ausgestellt");

        cy.request("GET", `${mailpitBaseUrl()}/api/v1/messages`).then((listRes) => {
          expect(listRes.status).to.eq(200);
          const messages = (
            listRes.body as { messages?: Array<{ ID: string; Subject: string; To?: unknown }> }
          ).messages ?? [];
          const hit = messages.find(
            (m) =>
              m.Subject === "Neue Teilnahmebescheinigung ausgestellt" &&
              jsonLowerIncludesEmail(m.To ?? [], tutorEmail!),
          );
          expect(hit, "Mailpit message to tutor").to.exist;

          cy.request("GET", `${mailpitBaseUrl()}/api/v1/message/${hit!.ID}`).then((detailRes) => {
            expect(detailRes.status).to.eq(200);
            const detail = detailRes.body as { To?: unknown; Bcc?: unknown };
            expect(jsonLowerIncludesEmail(detail.To, tutorEmail!), "SMTP To primary").to.eq(true);
            expect(jsonLowerIncludesEmail(detail.Bcc, tutorEmail!), "no duplicate BCC to same inbox").to.eq(
              false,
            );
          });
        });
      });
    });
  });

  it("redirects to expired page when enrollment window is closed", () => {
    const bearer = Cypress.env("TUTOR_API_TOKEN") as string | undefined;
    expect(bearer).to.be.a("string").and.not.be.empty;

    cy.task<MintSessionCredentialResult>("mintSessionCredential", { validUntilOffsetSeconds: -120 }).then((pack) => {
      cy.request({
        method: "POST",
        url: "/api/sessions",
        headers: { Authorization: `Bearer ${bearer}` },
        body: pack.credential,
      }).then((sessionRes) => {
        expect(sessionRes.status).to.eq(200);
        const enrollUrl = sessionRes.body.enroll_url as string;
        cy.visit(enrollUrl);
        cy.get("[data-cy=name-input]").type("Expired Case");
        cy.get("[data-cy=submit]").click();
        cy.url().should("include", "/enroll/expired");
        cy.get("[data-cy=expired-message]").should("be.visible");
      });
    });
  });
});

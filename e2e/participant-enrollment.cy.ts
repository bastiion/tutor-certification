/// <reference types="cypress" />

import type { MintSessionCredentialResult } from "./support/tasks/apiCryptoTasks";
import { mailpitBaseUrl, waitForMailpitSubject } from "./support/mailpit";

describe("participant enrollment (compose stack)", () => {
  it("issues a certificate with QR, download, print hook, and emails the tutor", () => {
    const bearer = Cypress.env("TUTOR_API_TOKEN") as string | undefined;
    const tutorEmail = Cypress.env("TUTOR_EMAIL") as string | undefined;
    expect(bearer, "TUTOR_API_TOKEN from docker/php/dev.env").to.be.a("string").and.not.be.empty;
    expect(tutorEmail, "TUTOR_EMAIL from docker/php/dev.env").to.be.a("string").and.not.be.empty;

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
        cy.visit(enrollUrl);
        cy.get("[data-cy=name-input]").type("Erika Musterfrau");
        cy.get("[data-cy=submit]").click();
        cy.get("[data-cy=certificate-name]").should("include.text", "Erika Musterfrau");
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

        cy.request("GET", `${mailpitBaseUrl()}/api/v1/messages`).then((listRes) => {
          expect(listRes.status).to.eq(200);
          const messages = (listRes.body as { messages?: Array<{ ID: string; Subject: string; To?: unknown }> })
            .messages ?? [];
          const hit = messages.find(
            (m) =>
              m.Subject === "Neue Teilnahmebescheinigung ausgestellt" &&
              JSON.stringify(m.To ?? []).includes(tutorEmail!),
          );
          expect(hit, "Mailpit message to tutor").to.exist;

          cy.request("GET", `${mailpitBaseUrl()}/api/v1/message/${hit!.ID}`).then((detailRes) => {
            expect(detailRes.status).to.eq(200);
            const attachments = (detailRes.body as { Attachments?: Array<{ FileName?: string }> }).Attachments ?? [];
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

/// <reference types="cypress" />

/**
 * Stage 8 — Document B: Cypress "user story" spec that captures every
 * screenshot the MkDocs customer documentation site embeds.
 *
 * Drives one cohesive flow: tutor → participant → verifier → revocation.
 * Each beat ends with cy.screenshot(<stable-name>).
 */

import type {
  MintSessionCredentialResult,
  EnrollAsResult,
} from "./support/tasks/apiCryptoTasks";
import {
  DOC_DEMO,
  EXPECTED_SCREENSHOTS,
  primeSessionStorage,
  setGermanLocale,
} from "./support/docDemo";

const shot = (name: string) => cy.screenshot(name, { capture: "viewport", overwrite: true });

describe("doc-screenshots — customer documentation captures", () => {
  let bearer: string;
  let pack: MintSessionCredentialResult;
  let enrollUrl: string;
  let certId: string;
  let certJSON: string;

  before(() => {
    bearer = Cypress.env("TUTOR_API_TOKEN") as string;
    expect(bearer, "TUTOR_API_TOKEN").to.be.a("string").and.not.be.empty;

    cy.request("DELETE", "http://localhost:8025/api/v1/messages").then((res) => {
      expect(res.status).to.be.oneOf([200, 204]);
    });
  });

  it("captures every documented scene", () => {
    // ── TUTOR LANE ──────────────────────────────────────────────────

    // Mint session credential via task (server-side)
    const runId = `doc-demo-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    cy.task<MintSessionCredentialResult>("mintSessionCredential", {
      courseId: runId,
      validUntilOffsetSeconds: DOC_DEMO.validUntilOffsetDays * 86400,
    }).then((_pack) => {
      pack = _pack;

      // tutor-01-home: Tutor home overview
      cy.visit("/tutor/", {
        onBeforeLoad(win) {
          setGermanLocale(win);
          primeSessionStorage(win, { bearer, masterSeedBase64Url: pack.masterSeedBase64Url });
        },
      });
      cy.get("[data-cy=tutor-home]", { timeout: 10_000 }).should("be.visible");
      shot("tutor-01-home");

      // tutor-02-keys-empty: Keys page before any key is loaded
      cy.visit("/tutor/keys", {
        onBeforeLoad(win) {
          setGermanLocale(win);
        },
      });
      cy.get("[data-cy=keys-empty]").should("exist");
      shot("tutor-02-keys-empty");

      // tutor-03-keys-generated: Keys page with K_master loaded (via E2E prefill)
      cy.visit("/tutor/keys", {
        onBeforeLoad(win) {
          setGermanLocale(win);
          primeSessionStorage(win, { bearer, masterSeedBase64Url: pack.masterSeedBase64Url });
        },
      });
      cy.get("[data-cy=keys-loaded]", { timeout: 10_000 }).should("exist");
      cy.get("[data-cy=keys-fingerprint-full]")
        .invoke("text")
        .should("match", /^[a-f0-9]{64}$/);
      shot("tutor-03-keys-generated");

      // tutor-04-server-config: Server config panel filled
      cy.get("[data-cy=server-config-panel]").should("be.visible");
      cy.get("[data-cy=server-key-status]", { timeout: 15_000 }).should("contain.text", "ok");
      shot("tutor-04-server-config");

      // Navigate to session creation (SPA link preserves in-memory key)
      cy.contains("a", "Weiter zu \u201eSitzung erstellen\u201c").click();
      cy.location("pathname").should("eq", "/tutor/sessions/new");
      cy.get("[data-cy=server-key-status]", { timeout: 15_000 }).should("contain.text", "ok");

      // tutor-05-create-session-form: Form filled with demo data
      cy.get("[data-cy=session-course-id-summary]").click();
      cy.get("[data-cy=session-course-id]").should("be.visible").clear().type(runId);
      cy.get("[data-cy=session-course-title]").clear().type(DOC_DEMO.courseTitle);
      cy.get("[data-cy=session-institute]").clear().type(DOC_DEMO.instituteName);
      cy.get("[data-cy=session-tutor-email-input]").clear().type(DOC_DEMO.tutorEmail);
      shot("tutor-05-create-session-form");

      // Submit session
      cy.get("[data-cy=session-submit]").should("not.be.disabled").click();
      cy.get("[data-cy=session-result]", { timeout: 15_000 }).should("be.visible");

      // tutor-06-session-result: Enroll URL + copy button
      shot("tutor-06-session-result");

      // Capture the enroll URL for participant lane
      cy.get("[data-cy=session-enroll-url]")
        .invoke("text")
        .then((urlText) => {
          enrollUrl = urlText.trim();

          // ── PARTICIPANT LANE ──────────────────────────────────────

          // teiln-01-link-form: Empty enrollment form
          cy.visit(enrollUrl, {
            onBeforeLoad(win) {
              setGermanLocale(win);
            },
          });
          cy.get("[data-cy=name-input]", { timeout: 10_000 }).should("be.visible");
          shot("teiln-01-link-form");

          // teiln-02-link-filled: Form with demo name entered
          cy.get("[data-cy=name-input]").type(DOC_DEMO.participantName);
          shot("teiln-02-link-filled");

          // Submit enrollment
          cy.get("[data-cy=submit]").click();

          // teiln-03-cert-view: Certificate with QR, name, fingerprint
          cy.get("[data-cy=certificate-name]", { timeout: 15_000 })
            .should("contain.text", DOC_DEMO.participantName);
          cy.get("[data-cy=certificate-qr] svg", { timeout: 10_000 }).should("exist");
          shot("teiln-03-cert-view");

          // teiln-04-actions: Download/print buttons
          cy.get("[data-cy=download-json]").should("be.visible");
          cy.get("[data-cy=print]").should("be.visible");
          cy.get("[data-cy=download-json]").scrollIntoView();
          shot("teiln-04-actions");

          // Now we need the cert data for verification steps — enroll via task
          cy.task<EnrollAsResult>("enrollAs", {
            enrollUrl: enrollUrl,
            apiOrigin: Cypress.config("baseUrl") ?? "http://localhost:7123",
            name: DOC_DEMO.participantName,
          }).then((enrolled) => {
            certId = enrolled.certId;
            certJSON = enrolled.certJSON;

            // teiln-05-expired: Expired enrollment link — submit triggers 410 → redirect
            cy.task<MintSessionCredentialResult>("mintSessionCredential", {
              validUntilOffsetSeconds: -120,
            }).then((expiredPack) => {
              cy.request({
                method: "POST",
                url: "/api/sessions",
                headers: { Authorization: `Bearer ${bearer}` },
                body: expiredPack.credential,
              }).then((sessRes) => {
                const expiredEnrollUrl = sessRes.body.enroll_url as string;
                cy.visit(expiredEnrollUrl, {
                  onBeforeLoad(win) {
                    setGermanLocale(win);
                  },
                });
                cy.get("[data-cy=name-input]", { timeout: 10_000 }).type("Abgelaufen Beispiel");
                cy.get("[data-cy=submit]").click();
                cy.url({ timeout: 10_000 }).should("include", "/enroll/expired");
                cy.get("[data-cy=expired-message]", { timeout: 10_000 }).should("be.visible");
                shot("teiln-05-expired");

                // ── VERIFIER LANE ────────────────────────────────────

                // pruef-01-landing: Drop zone landing
                cy.visit("/verify/", {
                  onBeforeLoad(win) {
                    setGermanLocale(win);
                  },
                });
                cy.get("[data-cy=drop-zone]", { timeout: 10_000 }).should("be.visible");
                shot("pruef-01-landing");

                // pruef-02-id-only-unknown: ID-only grey "unbekannt"
                cy.visit(`/verify/${certId}`, {
                  onBeforeLoad(win) {
                    setGermanLocale(win);
                  },
                });
                cy.get("[data-cy=status-unknown]", { timeout: 10_000 }).should("be.visible");
                shot("pruef-02-id-only-unknown");

                // pruef-03-drop-valid: Dropped JSON → green "gültig"
                cy.visit("/verify/", {
                  onBeforeLoad(win) {
                    setGermanLocale(win);
                  },
                });
                cy.writeFile("e2e/.tmp-doc-cert.json", certJSON);
                cy.get("[data-cy=drop-zone] input[type=file]").selectFile(
                  "e2e/.tmp-doc-cert.json",
                  { force: true },
                );
                cy.get("[data-cy=status-valid]", { timeout: 10_000 }).should("be.visible");
                cy.get("[data-cy=chip-online-no-revocation]").should("be.visible");
                shot("pruef-03-drop-valid");

                // pruef-06-details-expanded: Details panel open
                cy.get("[data-cy=details-toggle]").click();
                cy.get("[data-cy=details-panel]").should("be.visible");
                shot("pruef-06-details-expanded");

                // pruef-05-drop-tampered: Tampered certificate_sig
                const flipSig = (raw: string): string => {
                  const re = /("certificate_sig":")([A-Za-z0-9_-]+)(")/;
                  const m = re.exec(raw);
                  if (!m?.[2]) return raw;
                  const sig = m[2];
                  const flipped = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
                  return raw.replace(re, `$1${flipped}$3`);
                };
                cy.visit("/verify/", {
                  onBeforeLoad(win) {
                    setGermanLocale(win);
                  },
                });
                cy.writeFile("e2e/.tmp-doc-tampered.json", flipSig(certJSON));
                cy.get("[data-cy=drop-zone] input[type=file]").selectFile(
                  "e2e/.tmp-doc-tampered.json",
                  { force: true },
                );
                cy.get("[data-cy=status-tampered]", { timeout: 10_000 }).should("be.visible");
                shot("pruef-05-drop-tampered");

                // ── TUTOR REVOCATION LANE ────────────────────────────

                // tutor-07-audit-empty: Audit page before any import
                cy.visit("/tutor/audit", {
                  onBeforeLoad(win) {
                    setGermanLocale(win);
                    primeSessionStorage(win, { bearer, masterSeedBase64Url: pack.masterSeedBase64Url });
                  },
                });
                cy.get("[data-cy=tutor-audit]", { timeout: 10_000 }).should("be.visible");
                shot("tutor-07-audit-empty");

                // tutor-08-audit-imported: After cert import
                cy.writeFile("e2e/.tmp-doc-audit-cert.json", certJSON);
                cy.get("[data-cy=import-input]", { timeout: 15_000 }).selectFile(
                  "e2e/.tmp-doc-audit-cert.json",
                  { force: true },
                );
                cy.get(`[data-cy=row-status-${certId}]`, { timeout: 10_000 })
                  .should("contain.text", "gültig");
                shot("tutor-08-audit-imported");

                // tutor-09-revocation-form: Revocation dialog
                cy.intercept("POST", "**/api/revocations").as("postRevocation");
                cy.get(`[data-cy=revoke-${certId}]`, { timeout: 15_000 })
                  .should("not.be.disabled")
                  .click();
                cy.get("[data-cy=revoke-reason]").should("be.visible");
                cy.get("[data-cy=revoke-reason]").type(DOC_DEMO.revocationReason);
                shot("tutor-09-revocation-form");

                // tutor-10-revocation-confirmed: After revocation
                cy.get("[data-cy=revoke-confirm]").click();
                cy.wait("@postRevocation", { timeout: 15_000 });
                cy.get(`[data-cy=row-status-${certId}]`, { timeout: 15_000 })
                  .should("contain.text", "widerrufen");
                shot("tutor-10-revocation-confirmed");

                // pruef-04-drop-revoked: Verify shows revoked after revocation
                cy.visit("/verify/", {
                  onBeforeLoad(win) {
                    setGermanLocale(win);
                  },
                });
                cy.writeFile("e2e/.tmp-doc-revoked-cert.json", certJSON);
                cy.get("[data-cy=drop-zone] input[type=file]").selectFile(
                  "e2e/.tmp-doc-revoked-cert.json",
                  { force: true },
                );
                cy.get("[data-cy=status-revoked]", { timeout: 10_000 }).should("be.visible");
                shot("pruef-04-drop-revoked");

                // ── MAILPIT SCREENSHOTS ──────────────────────────────

                // Get the first message ID from Mailpit API
                cy.request("GET", "http://localhost:8025/api/v1/messages").then((apiRes) => {
                  const messages = (apiRes.body as { messages?: Array<{ ID: string }> }).messages ?? [];
                  expect(messages.length, "Mailpit should have at least one message").to.be.greaterThan(0);
                  const firstMessageId = messages[0]!.ID;

                  // tutor-11-mailpit-inbox
                  cy.origin("http://localhost:8025", () => {
                    cy.visit("/");
                    cy.contains("Neue Teilnahmebescheinigung", { timeout: 15_000 }).should("exist");
                    cy.wait(1000);
                    cy.screenshot("tutor-11-mailpit-inbox", { capture: "viewport", overwrite: true });
                  });

                  // tutor-12-mailpit-message
                  cy.origin(
                    "http://localhost:8025",
                    { args: { msgId: firstMessageId } },
                    ({ msgId }) => {
                      cy.visit(`/view/${msgId}`);
                      cy.contains("Neue Teilnahmebescheinigung", { timeout: 15_000 }).should("exist");
                      cy.wait(1000);
                      cy.screenshot("tutor-12-mailpit-message", { capture: "viewport", overwrite: true });

                      // tutor-13-mailpit-attachment: attachment details
                      cy.contains("button", "Show attachment details").then(($btn) => {
                        if ($btn.length) {
                          cy.wrap($btn).click();
                          cy.wait(500);
                        }
                      });
                      cy.screenshot("tutor-13-mailpit-attachment", { capture: "viewport", overwrite: true });
                    },
                  );
                });
              });
            });
          });
        });
    });
  });

  after(() => {
    cy.task("assertScreenshotsExist", [...EXPECTED_SCREENSHOTS]);
  });
});

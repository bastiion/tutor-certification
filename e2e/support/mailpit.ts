/**
 * Minimal Mailpit REST helpers for Cypress (host → Mailpit on localhost:8025).
 */

const DEFAULT_MAILPIT_BASE = "http://localhost:8025";

export function mailpitBaseUrl(): string {
  const u = Cypress.env("MAILPIT_BASE_URL");
  return typeof u === "string" && u.trim() !== "" ? u.trim() : DEFAULT_MAILPIT_BASE;
}

/** Poll until a message whose Subject equals `subject` exists (integration-style). */
export function waitForMailpitSubject(subject: string, options?: { timeoutMs?: number; intervalMs?: number }) {
  const timeoutMs = options?.timeoutMs ?? 25_000;
  const intervalMs = options?.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;

  const poll = (): void => {
    cy.request("GET", `${mailpitBaseUrl()}/api/v1/messages`).then((res) => {
      expect(res.status).to.eq(200);
      const messages = (res.body as { messages?: Array<{ Subject?: string }> }).messages ?? [];
      const hit = messages.some((m) => m.Subject === subject);
      if (hit) {
        return;
      }
      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for Mailpit message with subject: ${subject}`);
      }
      cy.wait(intervalMs).then(() => poll());
    });
  };

  poll();
}

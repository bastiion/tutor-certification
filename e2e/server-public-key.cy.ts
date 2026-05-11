/// <reference types="cypress" />

/** Minimal Base64URL decode (browser) — no padding assumed in API output */
function decodeBase64Url(urlSafe: string): Uint8Array {
  const padded = `${urlSafe}${"=".repeat((4 - (urlSafe.length % 4)) % 4)}`;
  const b64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

describe("GET /api/server-public-key (compose)", () => {
  it("returns JSON with 32-byte x25519_pk (base64url)", () => {
    cy.request("/api/server-public-key").then((res) => {
      expect(res.status).to.eq(200);
      expect(res.headers["content-type"]).to.match(/application\/json/);
      const pk = res.body.x25519_pk as string;
      expect(pk).to.be.a("string").and.not.be.empty;
      const raw = decodeBase64Url(pk);
      expect(raw.length).to.eq(32);
    });
  });
});

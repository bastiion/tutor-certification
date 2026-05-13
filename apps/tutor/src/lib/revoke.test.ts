import { beforeAll, describe, expect, mock, test } from "bun:test";
import { base64urlDecode, keypairFromSeed, ready, verifyDetached } from "@bastiion/crypto";
import { postRevocation } from "./revoke.ts";

beforeAll(async () => {
  await ready();
});

describe("postRevocation", () => {
  test("POST body verifies under K_master public; maps 401", async () => {
    const seed = new Uint8Array(32);
    crypto.getRandomValues(seed);
    const kp = await keypairFromSeed(seed);
    let capturedBody = "";
    const fetchMock = mock((url: string, init?: RequestInit) => {
      expect(String(url)).toContain("/revocations");
      capturedBody = String(init?.body ?? "");
      return Promise.resolve(
        new Response("{}", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    });

    const dead = new Uint8Array(seed);
    try {
      const res = await postRevocation({
        apiBaseUrl: "https://x.example/api",
        bearerToken: "tok",
        certId: "cid-1",
        revokedAt: "2026-05-11T12:00:00.000Z",
        reason: "r",
        kMasterSeed32: dead,
        fetchImpl: fetchMock as unknown as typeof fetch,
      });
      expect(res.ok).toBe(true);

      const body = JSON.parse(capturedBody) as {
        cert_id: string;
        revoked_at: string;
        signature: string;
      };
      const msg = new TextEncoder().encode(body.cert_id + body.revoked_at);
      const sigRaw = base64urlDecode(body.signature);
      expect(await verifyDetached(sigRaw, msg, kp.publicKey)).toBe(true);
    } finally {
      seed.fill(0);
      kp.secretKey.fill(0);
    }

    const fetch401 = mock(() =>
      Promise.resolve(new Response("", { status: 401, statusText: "Unauthorized" })),
    );
    const seed2 = new Uint8Array(32);
    crypto.getRandomValues(seed2);
    const r2 = await postRevocation({
      apiBaseUrl: "https://x.example/api",
      bearerToken: "bad",
      certId: "cid-1",
      revokedAt: "2026-05-11T12:00:00.000Z",
      reason: "r",
      kMasterSeed32: seed2,
      fetchImpl: fetch401 as unknown as typeof fetch,
    });
    expect(r2).toEqual({ ok: false, status: 401, message: "Bearer-Token erforderlich" });
    seed2.fill(0);

    const seed3 = new Uint8Array(32);
    crypto.getRandomValues(seed3);
    const fetch403 = mock(() => Promise.resolve(new Response("", { status: 403 })));
    const r3 = await postRevocation({
      apiBaseUrl: "https://x.example/api",
      bearerToken: "tok",
      certId: "cid-1",
      revokedAt: "2026-05-11T12:00:00.000Z",
      reason: "r",
      kMasterSeed32: seed3,
      fetchImpl: fetch403 as unknown as typeof fetch,
    });
    expect(r3).toEqual({ ok: false, status: 403, message: "Signatur ungültig" });
    seed3.fill(0);

    const seed4 = new Uint8Array(32);
    crypto.getRandomValues(seed4);
    const fetch409 = mock(() => Promise.resolve(new Response("{}", { status: 409 })));
    const r4 = await postRevocation({
      apiBaseUrl: "https://x.example/api",
      bearerToken: "tok",
      certId: "cid-1",
      revokedAt: "2026-05-11T12:00:00.000Z",
      reason: "r",
      kMasterSeed32: seed4,
      fetchImpl: fetch409 as unknown as typeof fetch,
    });
    expect(r4.ok).toBe(true);
    if (r4.ok) expect(r4.status).toBe(409);
    seed4.fill(0);

    const seed5 = new Uint8Array(32);
    crypto.getRandomValues(seed5);
    const fetch500 = mock(() => Promise.resolve(new Response("nope", { status: 500 })));
    const r5 = await postRevocation({
      apiBaseUrl: "https://x.example/api",
      bearerToken: "tok",
      certId: "cid-1",
      revokedAt: "2026-05-11T12:00:00.000Z",
      reason: "r",
      kMasterSeed32: seed5,
      fetchImpl: fetch500 as unknown as typeof fetch,
    });
    expect(r5).toEqual({ ok: false, status: 500, message: "nope" });
    seed5.fill(0);

    const seed6 = new Uint8Array(32);
    crypto.getRandomValues(seed6);
    const fetchTextThrows = mock(() =>
      Promise.resolve({
        status: 502,
        text: () => Promise.reject(new Error("read failed")),
      } as unknown as Response),
    );
    const r6 = await postRevocation({
      apiBaseUrl: "https://x.example/api",
      bearerToken: "tok",
      certId: "cid-1",
      revokedAt: "2026-05-11T12:00:00.000Z",
      reason: "r",
      kMasterSeed32: seed6,
      fetchImpl: fetchTextThrows as unknown as typeof fetch,
    });
    expect(r6).toEqual({ ok: false, status: 502, message: "HTTP 502" });
    seed6.fill(0);
  });
});

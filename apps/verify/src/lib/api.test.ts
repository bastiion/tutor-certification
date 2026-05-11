import { beforeEach, describe, expect, test } from "bun:test";
import { fetchVerifyStatus } from "./api.ts";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fetchVerifyStatus", () => {
  let calls: string[] = [];

  beforeEach(() => {
    calls = [];
  });

  test("uses relative path when api base is empty", async () => {
    const f: typeof fetch = (url) => {
      calls.push(String(url));
      return Promise.resolve(jsonResponse(200, { valid: true }));
    };
    const r = await fetchVerifyStatus("", "abc-uuid", f);
    expect(r).toEqual({ kind: "ok_no_revocation" });
    expect(calls[0]).toBe("/api/verify/abc-uuid");
  });

  test("joins non-empty origin with path", async () => {
    const f: typeof fetch = (url) => {
      calls.push(String(url));
      return Promise.resolve(jsonResponse(200, { valid: true }));
    };
    const r = await fetchVerifyStatus("http://localhost:7123/", "x", f);
    expect(r.kind).toBe("ok_no_revocation");
    expect(calls[0]).toBe("http://localhost:7123/api/verify/x");
  });

  test("404 -> not_found", async () => {
    const f: typeof fetch = () => Promise.resolve(new Response("", { status: 404 }));
    const r = await fetchVerifyStatus("", "x", f);
    expect(r).toEqual({ kind: "not_found" });
  });

  test("transport error -> network_error", async () => {
    const f: typeof fetch = () => Promise.reject(new Error("boom"));
    const r = await fetchVerifyStatus("", "x", f);
    expect(r).toEqual({ kind: "network_error" });
  });

  test("non-ok http -> http_error", async () => {
    const f: typeof fetch = () => Promise.resolve(new Response("", { status: 500 }));
    const r = await fetchVerifyStatus("", "x", f);
    expect(r).toEqual({ kind: "http_error", status: 500 });
  });

  test("invalid json body on 200 -> http_error", async () => {
    const f: typeof fetch = () =>
      Promise.resolve(
        new Response("not-json", { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    const r = await fetchVerifyStatus("", "x", f);
    expect(r).toEqual({ kind: "http_error", status: 200 });
  });

  test("json without valid field -> http_error", async () => {
    const f: typeof fetch = () => Promise.resolve(jsonResponse(200, { foo: 1 }));
    const r = await fetchVerifyStatus("", "x", f);
    expect(r).toEqual({ kind: "http_error", status: 200 });
  });

  test("valid false with malformed revocation_doc -> http_error", async () => {
    const f: typeof fetch = () =>
      Promise.resolve(jsonResponse(200, { valid: false, revocation_doc: { cert_id: "x" } }));
    const r = await fetchVerifyStatus("", "x", f);
    expect(r).toEqual({ kind: "http_error", status: 200 });
  });

  test("valid neither bool -> http_error", async () => {
    const f: typeof fetch = () => Promise.resolve(jsonResponse(200, { valid: 1 }));
    const r = await fetchVerifyStatus("", "x", f);
    expect(r).toEqual({ kind: "http_error", status: 200 });
  });
});

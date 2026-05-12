import { describe, expect, test } from "bun:test";
import { certificateWireSchema } from "@bastiion/verify/src/lib/certificateSchema.ts";
import {
  extractCertificatesFromEml,
  parseEmailAttachments,
  parseMailHeaders,
  splitMboxMessages,
} from "./parseEmailAttachments.ts";
import { parseInboundJson } from "./parseInboundJson.ts";

function certJson(): string {
  const c = certificateWireSchema.parse({
    cert_id: "33333333-3333-4333-8333-333333333333",
    version: 1,
    issued_at: "2026-05-11T12:00:00.000Z",
    course: { id: "44444444-4444-4444-8444-444444444444", title: "Mail", date: "2026-05-11" },
    participant: { name: "P" },
    institute: { name: "I", key_fingerprint: "b".repeat(64) },
    K_master_public: "x",
    K_course_public: "y",
    session_sig: "s",
    valid_until: 2_000_000_000,
    certificate_sig: "t",
  });
  return JSON.stringify(c);
}

describe("parseEmailAttachments", () => {
  test("parseMailHeaders folds continuation", () => {
    const h = parseMailHeaders("X-Test: line1\r\n continued\r\n\r\n");
    expect(h.get("x-test")).toBe("line1 continued");
  });

  test("extractCertificatesFromEml finds JSON attachment (base64)", () => {
    const json = certJson();
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const eml = [
      "MIME-Version: 1.0",
      'Content-Type: multipart/mixed; boundary="b1"',
      "",
      "--b1",
      "Content-Type: text/plain",
      "",
      "hello",
      "--b1",
      "Content-Type: application/json; name=\"x.cert.json\"",
      "Content-Transfer-Encoding: base64",
      "",
      b64,
      "--b1--",
      "",
    ].join("\r\n");
    const got = extractCertificatesFromEml(eml);
    expect(got.length).toBe(1);
    expect(got[0]).toBe(json);
  });

  test("extractCertificatesFromEml inline body fallback", () => {
    const json = certJson();
    const eml = ["Content-Type: text/plain", "", `prefix ${json} suffix`].join("\r\n");
    const got = extractCertificatesFromEml(eml);
    expect(got.length).toBe(1);
  });

  test("parseEmailAttachments mbox single message", () => {
    const json = certJson();
    const inner = ["Content-Type: application/json", "", json].join("\r\n");
    const mbox = `From x Fri Sep  1 00:00:00 2026\n${inner}`;
    const r = parseEmailAttachments(mbox, "mbox");
    expect(r.length).toBe(1);
    expect(r[0]).toBe(json);
  });

  test("parseEmailAttachments mbox two messages dedupes identical JSON", () => {
    const json = certJson();
    const inner = ["Content-Type: application/json", "", json].join("\r\n");
    const mbox = [`From a Fri Sep  1 00:00:00 2026`, inner, `From b Sat Sep  2 00:00:00 2026`, inner].join("\n");
    const r = parseEmailAttachments(mbox, "mbox");
    expect(r.length).toBe(1);
  });

  test("boundary may be quoted in Content-Type", () => {
    const json = certJson();
    const b64 = btoa(unescape(encodeURIComponent(json)));
    const eml = [
      "MIME-Version: 1.0",
      'Content-Type: multipart/mixed; boundary="bq"',
      "",
      "--bq",
      "Content-Type: application/json",
      "Content-Transfer-Encoding: base64",
      "",
      b64,
      "--bq--",
      "",
    ].join("\r\n");
    expect(extractCertificatesFromEml(eml)).toEqual([json]);
  });

  test("quoted-printable JSON part", () => {
    const json = certJson();
    const qp = json.replace(/=/g, "=3D");
    const eml = [
      "Content-Type: multipart/mixed; boundary=x",
      "",
      "--x",
      "Content-Type: application/json",
      "Content-Transfer-Encoding: quoted-printable",
      "",
      qp,
      "--x--",
    ].join("\r\n");
    expect(extractCertificatesFromEml(eml)).toEqual([json]);
  });

  test("nested multipart yields JSON in inner part", () => {
    const json = certJson();
    const eml = [
      "Content-Type: multipart/mixed; boundary=outer",
      "",
      "--outer",
      "Content-Type: multipart/mixed; boundary=inner",
      "",
      "--inner",
      "Content-Type: application/json",
      "",
      json,
      "--inner--",
      "--outer--",
    ].join("\r\n");
    const got = extractCertificatesFromEml(eml);
    expect(got).toEqual([json]);
  });

  test("inline JSON scanner handles escaped quotes in participant name", () => {
    const base = JSON.parse(certJson()) as Record<string, unknown>;
    base.participant = { name: 'O "Q" O' };
    const json = JSON.stringify(base);
    expect(parseInboundJson(json).ok).toBe(true);
    const eml = ["Content-Type: text/plain", "", `xx ${json} yy`].join("\r\n");
    expect(extractCertificatesFromEml(eml).length).toBe(1);
  });

  test("multipart chunk without headers — inline still finds JSON in message", () => {
    const json = certJson();
    const eml = ["Content-Type: multipart/mixed; boundary=z", "", `--z`, json, `--z--`].join("\r\n");
    expect(extractCertificatesFromEml(eml)).toEqual([json]);
  });

  test("reject EML with no cert", () => {
    const eml = ["Content-Type: text/plain", "", "nope"].join("\r\n");
    expect(extractCertificatesFromEml(eml).length).toBe(0);
  });

  test("splitMboxMessages empty From handling", () => {
    const json = certJson();
    const single = ["Content-Type: application/json", "", json].join("\r\n");
    expect(splitMboxMessages(single).length).toBe(1);
  });
});

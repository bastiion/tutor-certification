import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sliceCertificateSigningJson } from "./signingSlice.ts";

const fixtureDir = join(import.meta.dir, "__fixtures__");

describe("sliceCertificateSigningJson", () => {
  test("matches committed signing fixture (PHP toSigningJson byte identity tripwire)", () => {
    const raw = readFileSync(join(fixtureDir, "cert-response.regression.json"), "utf8").trim();
    const expectedSigning = readFileSync(join(fixtureDir, "cert-signing.regression.json"), "utf8").trim();
    expect(sliceCertificateSigningJson(raw)).toBe(expectedSigning);
  });
});

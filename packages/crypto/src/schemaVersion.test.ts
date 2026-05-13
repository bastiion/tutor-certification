import { describe, expect, test } from "bun:test";
import { CURRENT_CERT_SCHEMA_VERSION, CURRENT_REVOCATION_SCHEMA_VERSION } from "./schemaVersion.ts";

describe("schemaVersion", () => {
  test("certificate version is 1", () => {
    expect(CURRENT_CERT_SCHEMA_VERSION).toBe(1);
  });

  test("revocation version is 1", () => {
    expect(CURRENT_REVOCATION_SCHEMA_VERSION).toBe(1);
  });
});

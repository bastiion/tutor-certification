import { describe, expect, test } from "bun:test";
import sodium from "libsodium-wrappers";
import { parseCli, helpText } from "./cli.ts";
import { renderEnvFile, defaultEnvForAuto, PLACEHOLDER } from "./envTemplate.ts";
import type { EnvFields } from "./envTemplate.ts";
import { concatBoxKeypairBytes, generateSecrets } from "./secrets.ts";

describe("parseCli", () => {
  test("parses --auto and --out", () => {
    const p = parseCli(["bun", "main.ts", "--auto", "--out", "/tmp/out"]);
    expect(p.auto).toBe(true);
    expect(p.outFile).toBe("/tmp/out/.env");
  });

  test("throws when --out has no value", () => {
    expect(() => parseCli(["bun", "main.ts", "--out"])).toThrow();
  });

  test("treats .env path as file", () => {
    const p = parseCli(["bun", "main.ts", "--out=/data/prod.env"]);
    expect(p.outFile).toBe("/data/prod.env");
  });

  test("help flag", () => {
    expect(parseCli(["bun", "x", "-h"]).help).toBe(true);
  });
});

describe("concatBoxKeypairBytes", () => {
  test("rejects wrong lengths", () => {
    expect(() => concatBoxKeypairBytes(new Uint8Array(31), new Uint8Array(32))).toThrow(
      "Unexpected crypto_box keypair sizes",
    );
  });
});

describe("generateSecrets", () => {
  test("produces formats compatible with PHP Env::base64UrlDecode", async () => {
    await sodium.ready;
    const s = await generateSecrets();

    const box = sodium.from_base64(
      s.SERVER_BOX_KEYPAIR_BASE64,
      sodium.base64_variants.URLSAFE_NO_PADDING,
    );
    expect(box.length).toBe(64);

    const tok = sodium.from_base64(
      s.TOKEN_HMAC_KEY_BASE64,
      sodium.base64_variants.URLSAFE_NO_PADDING,
    );
    expect(tok.length).toBe(32);

    expect(s.TUTOR_API_TOKEN.length).toBe(64);
    expect(/^[0-9a-f]{64}$/.test(s.TUTOR_API_TOKEN)).toBe(true);
  });
});

describe("renderEnvFile / defaultEnvForAuto", () => {
  test("quotes values with shell-metacharacters", async () => {
    const secrets = await generateSecrets();
    const fields: EnvFields = {
      ...defaultEnvForAuto(secrets),
      REGISTRY_IMAGE: "ghcr.io/org/with space",
      DOMAIN: 'foo";rm -rf /',
    };
    const txt = renderEnvFile(fields);
    expect(txt).toContain('REGISTRY_IMAGE="ghcr.io/org/with space"');
    expect(txt).toContain('DOMAIN="foo\\";rm -rf /"');
  });

  test("auto preset keeps placeholders for operator-filled fields", async () => {
    const secrets = await generateSecrets();
    const env = defaultEnvForAuto(secrets);
    expect(env.REGISTRY_IMAGE).toBe(PLACEHOLDER.REGISTRY_IMAGE);
    expect(env.PUBLIC_BASE_URL).toBe(PLACEHOLDER.PUBLIC_BASE_URL);
    expect(env.SERVER_BOX_KEYPAIR_BASE64).toBe(secrets.SERVER_BOX_KEYPAIR_BASE64);
    const txt = renderEnvFile(env);
    expect(txt).toContain("SERVER_BOX_KEYPAIR_BASE64=");
    expect(txt).toContain(PLACEHOLDER.PUBLIC_BASE_URL);
  });

  test('render lists optional SMTP auth keys', async () => {
    const secrets = await generateSecrets();
    const txt = renderEnvFile(defaultEnvForAuto(secrets));
    expect(txt).toContain("SMTP_SECURE=");
    expect(txt).toContain("SMTP_USER=");
    expect(txt).toContain("SMTP_PASSWORD=");
  });

  test("render includes Traefik section comments", async () => {
    const secrets = await generateSecrets();
    const txt = renderEnvFile(defaultEnvForAuto(secrets));
    expect(txt).toContain("Traefik");
  });
});

test("helpText mentions docker run", () => {
  expect(helpText("env-wizard")).toContain("docker run");
});

import { beforeEach, describe, expect, test } from "bun:test";
import {
  cacheServerPublicKey,
  clearServerConfig,
  defaultApiBaseUrl,
  isServerConfigInput,
  loadServerConfig,
  parseServerConfig,
  readCachedServerPublicKey,
  saveServerConfig,
  serverPublicKeyResponseSchema,
  type KeyValueStorage,
} from "./serverConfig.ts";

function inMemoryStorage(): KeyValueStorage & { dump(): Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
    dump: () => Object.fromEntries(map),
  };
}

describe("parseServerConfig", () => {
  test("trims whitespace and strips trailing slashes from the API base URL", () => {
    const cfg = parseServerConfig({
      apiBaseUrl: "  https://example.test/api/  ",
      tutorApiToken: "  tok  ",
    });
    expect(cfg).toEqual({
      apiBaseUrl: "https://example.test/api",
      tutorApiToken: "tok",
    });
  });

  test("rejects empty fields", () => {
    expect(() => parseServerConfig({ apiBaseUrl: "", tutorApiToken: "tok" })).toThrow();
    expect(() => parseServerConfig({ apiBaseUrl: "http://x/api", tutorApiToken: "" })).toThrow();
  });

  test("rejects malformed and non-http(s) URLs", () => {
    expect(() => parseServerConfig({ apiBaseUrl: "not a url", tutorApiToken: "t" })).toThrow();
    expect(() => parseServerConfig({ apiBaseUrl: "ftp://x/api", tutorApiToken: "t" })).toThrow();
  });

  test("rejects missing fields", () => {
    expect(() => parseServerConfig({ apiBaseUrl: "http://x/api" })).toThrow();
  });
});

describe("isServerConfigInput", () => {
  test("guards correctly for valid and invalid inputs", () => {
    expect(isServerConfigInput({ apiBaseUrl: "http://x/api", tutorApiToken: "t" })).toBe(true);
    expect(isServerConfigInput({ apiBaseUrl: "", tutorApiToken: "t" })).toBe(false);
    expect(isServerConfigInput("nope")).toBe(false);
  });
});

describe("save/load/clear roundtrip", () => {
  let storage: ReturnType<typeof inMemoryStorage>;

  beforeEach(() => {
    storage = inMemoryStorage();
  });

  test("save then load returns the canonical config", () => {
    const saved = saveServerConfig(
      { apiBaseUrl: "https://example.test/api/", tutorApiToken: "secret" },
      storage,
    );
    expect(saved.apiBaseUrl).toBe("https://example.test/api");

    const loaded = loadServerConfig("https://example.test/api/", storage);
    expect(loaded).toEqual(saved);
  });

  test("load returns null when no value is stored", () => {
    expect(loadServerConfig("https://example.test/api", storage)).toBeNull();
  });

  test("load returns null for malformed JSON", () => {
    storage.setItem("serverConfig:https://example.test/api", "not json");
    expect(loadServerConfig("https://example.test/api", storage)).toBeNull();
  });

  test("load returns null for stored values that fail validation", () => {
    storage.setItem(
      "serverConfig:https://example.test/api",
      JSON.stringify({ apiBaseUrl: "", tutorApiToken: "" }),
    );
    expect(loadServerConfig("https://example.test/api", storage)).toBeNull();
  });

  test("clear removes both config and the cached server public key", () => {
    saveServerConfig({ apiBaseUrl: "http://x/api", tutorApiToken: "t" }, storage);
    cacheServerPublicKey("http://x/api", "AAAA", storage);
    clearServerConfig("http://x/api", storage);
    expect(storage.dump()).toEqual({});
  });
});

describe("server public key cache", () => {
  let storage: ReturnType<typeof inMemoryStorage>;

  beforeEach(() => {
    storage = inMemoryStorage();
  });

  test("round-trips a base64url string", () => {
    cacheServerPublicKey("http://x/api", "AbCd-_09", storage);
    expect(readCachedServerPublicKey("http://x/api", storage)).toBe("AbCd-_09");
  });

  test("rejects non-URL-safe alphabets when caching", () => {
    expect(() => cacheServerPublicKey("http://x/api", "AB+/=", storage)).toThrow(SyntaxError);
  });

  test("returns null when nothing is cached", () => {
    expect(readCachedServerPublicKey("http://x/api", storage)).toBeNull();
  });

  test("returns null when the cached value is corrupt", () => {
    storage.setItem("serverPublicKey:http://x/api", "not!valid");
    expect(readCachedServerPublicKey("http://x/api", storage)).toBeNull();
  });
});

describe("serverPublicKeyResponseSchema", () => {
  test("accepts a valid response", () => {
    const ok = serverPublicKeyResponseSchema.safeParse({ x25519_pk: "Abc-_09" });
    expect(ok.success).toBe(true);
  });

  test("rejects empty or non-base64url values", () => {
    expect(serverPublicKeyResponseSchema.safeParse({ x25519_pk: "" }).success).toBe(false);
    expect(serverPublicKeyResponseSchema.safeParse({ x25519_pk: "AB+/=" }).success).toBe(false);
    expect(serverPublicKeyResponseSchema.safeParse({}).success).toBe(false);
  });
});

describe("defaultApiBaseUrl", () => {
  test("derives /api from a provided origin", () => {
    expect(defaultApiBaseUrl("https://example.test")).toBe("https://example.test/api");
  });

  test("falls back to the dev compose URL when origin is missing or empty", () => {
    expect(defaultApiBaseUrl(undefined)).toBe("http://localhost:7123/api");
    expect(defaultApiBaseUrl("")).toBe("http://localhost:7123/api");
  });
});

import { describe, expect, test } from "bun:test";
import { createKeyVaultStore, KMASTER_SEED_LENGTH } from "./keyVaultStore.ts";

describe("createKeyVaultStore", () => {
  test("starts empty", () => {
    const vault = createKeyVaultStore();
    expect(vault.snapshot()).toEqual({ hasSeed: false, revision: 0 });
    expect(() => vault.exportSeed()).toThrow(/empty/);
  });

  test("generate stores 32 bytes from the supplied RNG", () => {
    const rng = (n: number): Uint8Array => new Uint8Array(n).fill(0x42);
    const vault = createKeyVaultStore({ getRandomBytes: rng });
    const snap = vault.generate();
    expect(snap.hasSeed).toBe(true);
    expect(snap.revision).toBe(1);
    const exported = vault.exportSeed();
    expect(exported.length).toBe(KMASTER_SEED_LENGTH);
    for (const b of exported) expect(b).toBe(0x42);
  });

  test("generate uses crypto.getRandomValues by default and the seed is non-zero", () => {
    const vault = createKeyVaultStore();
    vault.generate();
    const exported = vault.exportSeed();
    expect(exported.length).toBe(KMASTER_SEED_LENGTH);
    expect(exported.some((b) => b !== 0)).toBe(true);
  });

  test("generate rejects RNGs that misbehave", () => {
    const tooShort = createKeyVaultStore({ getRandomBytes: () => new Uint8Array(31) });
    expect(() => tooShort.generate()).toThrow(/32 bytes/);
    const wrongShape = createKeyVaultStore({
      getRandomBytes: (() => "nope") as unknown as (n: number) => Uint8Array,
    });
    expect(() => wrongShape.generate()).toThrow(/32 bytes/);
  });

  test("importSeed accepts a 32-byte Uint8Array and copies it", () => {
    const vault = createKeyVaultStore();
    const original = new Uint8Array(KMASTER_SEED_LENGTH).fill(0x07);
    vault.importSeed(original);
    original.fill(0x00);
    const exported = vault.exportSeed();
    for (const b of exported) expect(b).toBe(0x07);
  });

  test("importSeed rejects wrong-length and wrong-type inputs", () => {
    const vault = createKeyVaultStore();
    expect(() => vault.importSeed(new Uint8Array(31))).toThrow(RangeError);
    expect(() => vault.importSeed("deadbeef" as unknown as Uint8Array)).toThrow(TypeError);
  });

  test("forget zeroes the seed and reports an empty snapshot", () => {
    const vault = createKeyVaultStore();
    vault.generate();
    expect(vault.snapshot().hasSeed).toBe(true);
    const cleared = vault.forget();
    expect(cleared.hasSeed).toBe(false);
    expect(() => vault.exportSeed()).toThrow();
  });

  test("subscribe receives a snapshot on every successful change and unsubscribe stops events", () => {
    const vault = createKeyVaultStore();
    const events: number[] = [];
    const off = vault.subscribe((snap) => {
      events.push(snap.revision);
    });
    vault.generate();
    vault.importSeed(new Uint8Array(32).fill(1));
    off();
    vault.forget();
    expect(events).toEqual([1, 2]);
  });

  test("exportSeed returns a defensive copy", () => {
    const vault = createKeyVaultStore();
    vault.importSeed(new Uint8Array(32).fill(0xaa));
    const a = vault.exportSeed();
    const b = vault.exportSeed();
    expect(a).not.toBe(b);
    a.fill(0);
    const c = vault.exportSeed();
    for (const byte of c) expect(byte).toBe(0xaa);
  });
});

/**
 * Static guard: forbid persistence of K_master / seed material to durable
 * browser storage from anywhere under `apps/tutor/src/`.
 *
 * The acceptance gate in `doc/plan/stages/03-tutor-session-creation.md`
 * requires that `localStorage`/`sessionStorage`/`indexedDB` is never used on
 * the same line as `seed` or `master`. Test files themselves (this file
 * included) are excluded so the guard cannot recurse on its own assertions.
 */

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const STORAGE_RE = /(localStorage|sessionStorage|indexedDB)/i;
const SECRET_TOKEN_RE = /\b(seed|master)\b/i;
const ROOT = new URL("../", import.meta.url).pathname;

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) {
      out.push(...walk(p));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(p);
    }
  }
  return out;
}

describe("apps/tutor/src never persists K_master material", () => {
  const offenders: { file: string; line: number; text: string }[] = [];
  for (const file of walk(ROOT)) {
    if (file.includes("__tests__")) continue;
    if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue;
    const text = readFileSync(file, "utf8");
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      if (STORAGE_RE.test(line) && SECRET_TOKEN_RE.test(line)) {
        offenders.push({ file, line: i + 1, text: line.trim() });
      }
    }
  }

  test("no source line writes seed/master to durable browser storage", () => {
    expect(offenders).toEqual([]);
  });
});

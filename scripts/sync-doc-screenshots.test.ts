import { test, expect, beforeEach, afterEach } from "bun:test";
import { syncDocScreenshots, formatSyncReport, type SyncResult } from "./sync-doc-screenshots";
import { mkdtemp, rm, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempDir: string;
let srcDir: string;
let destDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "sync-test-"));
  srcDir = join(tempDir, "src");
  destDir = join(tempDir, "dest");
  await mkdir(srcDir, { recursive: true });
  await mkdir(destDir, { recursive: true });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("copies screenshots from source to destination", async () => {
  await writeFile(join(srcDir, "tutor-01-home.png"), "fake-png-data");
  await writeFile(join(srcDir, "tutor-02-keys-empty.png"), "fake-png-data-2");

  const result = await syncDocScreenshots({
    screenshotsDir: srcDir,
    docsImgDir: destDir,
    prune: false,
  });

  expect(result.copied).toHaveLength(2);
  expect(result.copied).toContain("tutor-01-home.png");
  expect(result.copied).toContain("tutor-02-keys-empty.png");
  expect(result.stale).toHaveLength(0);

  const destFiles = await readdir(destDir);
  expect(destFiles).toContain("tutor-01-home.png");
  expect(destFiles).toContain("tutor-02-keys-empty.png");
});

test("is idempotent — running twice produces same result", async () => {
  await writeFile(join(srcDir, "test.png"), "data");

  const r1 = await syncDocScreenshots({ screenshotsDir: srcDir, docsImgDir: destDir, prune: false });
  const r2 = await syncDocScreenshots({ screenshotsDir: srcDir, docsImgDir: destDir, prune: false });

  expect(r1.copied).toEqual(r2.copied);
  const files = await readdir(destDir);
  expect(files.filter((f) => f.endsWith(".png"))).toHaveLength(1);
});

test("detects stale screenshots without pruning", async () => {
  await writeFile(join(destDir, "old-screenshot.png"), "stale");

  const result = await syncDocScreenshots({
    screenshotsDir: srcDir,
    docsImgDir: destDir,
    prune: false,
  });

  expect(result.stale).toContain("old-screenshot.png");
  expect(result.pruned).toHaveLength(0);
  const files = await readdir(destDir);
  expect(files).toContain("old-screenshot.png");
});

test("prunes stale screenshots when --prune is set", async () => {
  await writeFile(join(destDir, "old-screenshot.png"), "stale");
  await writeFile(join(srcDir, "new-screenshot.png"), "fresh");

  const result = await syncDocScreenshots({
    screenshotsDir: srcDir,
    docsImgDir: destDir,
    prune: true,
  });

  expect(result.stale).toContain("old-screenshot.png");
  expect(result.pruned).toContain("old-screenshot.png");
  expect(result.copied).toContain("new-screenshot.png");

  const files = await readdir(destDir);
  expect(files).toContain("new-screenshot.png");
  expect(files).not.toContain("old-screenshot.png");
});

test("handles empty source directory gracefully", async () => {
  const result = await syncDocScreenshots({
    screenshotsDir: srcDir,
    docsImgDir: destDir,
    prune: false,
  });

  expect(result.copied).toHaveLength(0);
  expect(result.stale).toHaveLength(0);
});

test("handles non-existent source directory gracefully", async () => {
  const result = await syncDocScreenshots({
    screenshotsDir: join(tempDir, "nonexistent"),
    docsImgDir: destDir,
    prune: false,
  });

  expect(result.copied).toHaveLength(0);
});

test("creates destination directory if it does not exist", async () => {
  const newDest = join(tempDir, "new", "nested", "dest");
  await writeFile(join(srcDir, "shot.png"), "data");

  const result = await syncDocScreenshots({
    screenshotsDir: srcDir,
    docsImgDir: newDest,
    prune: false,
  });

  expect(result.copied).toHaveLength(1);
  const files = await readdir(newDest);
  expect(files).toContain("shot.png");
});

test("ignores non-png files in source directory", async () => {
  await writeFile(join(srcDir, "readme.txt"), "text");
  await writeFile(join(srcDir, "shot.png"), "data");

  const result = await syncDocScreenshots({
    screenshotsDir: srcDir,
    docsImgDir: destDir,
    prune: false,
  });

  expect(result.copied).toEqual(["shot.png"]);
});

test("formatSyncReport with no stale files", () => {
  const result: SyncResult = { copied: ["a.png", "b.png"], stale: [], pruned: [] };
  const report = formatSyncReport(result, "/dest");
  expect(report.lines[0]).toContain("2");
  expect(report.warnings).toHaveLength(0);
});

test("formatSyncReport with stale files (no prune)", () => {
  const result: SyncResult = { copied: ["a.png"], stale: ["old.png"], pruned: [] };
  const report = formatSyncReport(result, "/dest");
  expect(report.warnings.length).toBeGreaterThan(0);
  expect(report.warnings[0]).toContain("old.png");
});

test("formatSyncReport with pruned files", () => {
  const result: SyncResult = { copied: ["a.png"], stale: ["old.png"], pruned: ["old.png"] };
  const report = formatSyncReport(result, "/dest");
  expect(report.lines.some((l) => l.includes("Pruned"))).toBe(true);
  expect(report.warnings).toHaveLength(0);
});

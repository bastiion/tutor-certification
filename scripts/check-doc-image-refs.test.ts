import { test, expect, beforeEach, afterEach } from "bun:test";
import { checkDocImageRefs, formatCheckReport, type CheckResult } from "./check-doc-image-refs";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "check-refs-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

test("finds all refs and reports none missing when images exist", async () => {
  await mkdir(join(tempDir, "img"), { recursive: true });
  await writeFile(join(tempDir, "img", "shot.png"), "data");
  await writeFile(
    join(tempDir, "page.md"),
    "# Title\n\n![Screenshot](img/shot.png)\n",
  );

  const result = await checkDocImageRefs(tempDir);

  expect(result.refs).toHaveLength(1);
  expect(result.refs[0]!.ref).toBe("img/shot.png");
  expect(result.refs[0]!.line).toBe(3);
  expect(result.missing).toHaveLength(0);
});

test("reports missing image refs", async () => {
  await writeFile(
    join(tempDir, "page.md"),
    "![Missing](img/nonexistent.png)\n",
  );

  const result = await checkDocImageRefs(tempDir);

  expect(result.refs).toHaveLength(1);
  expect(result.missing).toHaveLength(1);
  expect(result.missing[0]!.ref).toBe("img/nonexistent.png");
  expect(result.missing[0]!.line).toBe(1);
});

test("ignores external URLs (http/https)", async () => {
  await writeFile(
    join(tempDir, "page.md"),
    "![External](https://example.com/image.png)\n![Also](http://example.com/x.png)\n",
  );

  const result = await checkDocImageRefs(tempDir);

  expect(result.refs).toHaveLength(0);
  expect(result.missing).toHaveLength(0);
});

test("handles multiple refs on the same line", async () => {
  await writeFile(
    join(tempDir, "page.md"),
    "![A](img/a.png) text ![B](img/b.png)\n",
  );

  const result = await checkDocImageRefs(tempDir);

  expect(result.refs).toHaveLength(2);
  expect(result.missing).toHaveLength(2);
});

test("walks subdirectories recursively", async () => {
  await mkdir(join(tempDir, "sub"), { recursive: true });
  await mkdir(join(tempDir, "sub", "img"), { recursive: true });
  await writeFile(join(tempDir, "sub", "img", "deep.png"), "data");
  await writeFile(
    join(tempDir, "sub", "page.md"),
    "![Deep](img/deep.png)\n",
  );

  const result = await checkDocImageRefs(tempDir);

  expect(result.refs).toHaveLength(1);
  expect(result.missing).toHaveLength(0);
});

test("handles empty directory with no markdown files", async () => {
  const result = await checkDocImageRefs(tempDir);

  expect(result.refs).toHaveLength(0);
  expect(result.missing).toHaveLength(0);
});

test("handles markdown file with no image refs", async () => {
  await writeFile(join(tempDir, "plain.md"), "# Just text\n\nNo images here.\n");

  const result = await checkDocImageRefs(tempDir);

  expect(result.refs).toHaveLength(0);
  expect(result.missing).toHaveLength(0);
});

test("formatCheckReport with no missing refs", () => {
  const result: CheckResult = { refs: [{ file: "a.md", line: 1, ref: "img/x.png" }], missing: [] };
  const report = formatCheckReport(result);
  expect(report.exitCode).toBe(0);
  expect(report.errors).toHaveLength(0);
  expect(report.summary).toContain("All image references resolved");
});

test("formatCheckReport with missing refs", () => {
  const result: CheckResult = {
    refs: [{ file: "a.md", line: 1, ref: "img/x.png" }],
    missing: [{ file: "a.md", line: 1, ref: "img/x.png" }],
  };
  const report = formatCheckReport(result);
  expect(report.exitCode).toBe(1);
  expect(report.errors.length).toBeGreaterThan(0);
  expect(report.errors[0]!).toContain("Missing 1");
});

test("resolves relative paths from the markdown file location", async () => {
  await mkdir(join(tempDir, "section"), { recursive: true });
  await mkdir(join(tempDir, "section", "img"), { recursive: true });
  await writeFile(join(tempDir, "section", "img", "local.png"), "data");
  await writeFile(
    join(tempDir, "section", "page.md"),
    "![Local](img/local.png)\n![Parent](../img/top.png)\n",
  );

  const result = await checkDocImageRefs(tempDir);

  expect(result.refs).toHaveLength(2);
  expect(result.missing).toHaveLength(1);
  expect(result.missing[0]!.ref).toBe("../img/top.png");
});

/**
 * Walk doc/customer/docs/**\/*.md and assert every ![alt](img/…) ref
 * resolves to an existing file.
 *
 * Library module — the CLI entry is check-doc-image-refs.cli.ts.
 */

import { readdir, stat } from "node:fs/promises";
import { join, dirname } from "node:path";

export interface CheckResult {
  refs: { file: string; line: number; ref: string }[];
  missing: { file: string; line: number; ref: string }[];
}

export async function checkDocImageRefs(docsDir: string): Promise<CheckResult> {
  const result: CheckResult = { refs: [], missing: [] };
  const mdFiles = await walkMdFiles(docsDir);

  for (const mdFile of mdFiles) {
    const content = await Bun.file(mdFile).text();
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];
      if (line === undefined) continue;
      const matches = line.matchAll(/!\[[^\]]*\]\(([^)]+)\)/g);
      for (const match of matches) {
        const ref = match[1];
        if (ref === undefined) continue;
        if (!ref.startsWith("http://") && !ref.startsWith("https://")) {
          result.refs.push({ file: mdFile, line: lineNum, ref });
          const resolved = join(dirname(mdFile), ref);
          try {
            await stat(resolved);
          } catch {
            result.missing.push({ file: mdFile, line: lineNum, ref });
          }
        }
      }
    }
  }

  return result;
}

async function walkMdFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkMdFiles(fullPath)));
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }
  return files;
}

export function formatCheckReport(result: CheckResult): { summary: string; errors: string[]; exitCode: number } {
  const summary = `Checked ${result.refs.length} image ref(s) across markdown files.`;
  if (result.missing.length === 0) {
    return { summary: `${summary} All image references resolved.`, errors: [], exitCode: 0 };
  }
  const errors = [
    `Missing ${result.missing.length} image(s):`,
    ...result.missing.map((m) => `  ${m.file}:${m.line} -> ${m.ref}`),
  ];
  return { summary, errors, exitCode: 1 };
}

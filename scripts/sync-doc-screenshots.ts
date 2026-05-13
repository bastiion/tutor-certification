/**
 * Copy Cypress doc-mode screenshots into the MkDocs image directory.
 *
 * Library module — the CLI entry is sync-doc-screenshots.cli.ts.
 */

import { readdir, copyFile, unlink, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface SyncResult {
  copied: string[];
  stale: string[];
  pruned: string[];
}

export async function syncDocScreenshots(opts: {
  screenshotsDir: string;
  docsImgDir: string;
  prune: boolean;
}): Promise<SyncResult> {
  const { screenshotsDir, docsImgDir, prune } = opts;
  const result: SyncResult = { copied: [], stale: [], pruned: [] };

  await mkdir(docsImgDir, { recursive: true });

  let sourceFiles: string[];
  try {
    const allEntries = await readdir(screenshotsDir);
    sourceFiles = allEntries.filter((f) => f.endsWith(".png"));
  } catch {
    sourceFiles = [];
  }

  const sourceNames = new Set(sourceFiles);

  for (const file of sourceFiles) {
    await copyFile(join(screenshotsDir, file), join(docsImgDir, file));
    result.copied.push(file);
  }

  const allExisting = await readdir(docsImgDir);
  const existingFiles = allExisting.filter((f) => f.endsWith(".png"));

  for (const file of existingFiles) {
    if (!sourceNames.has(file)) {
      result.stale.push(file);
      if (prune) {
        await unlink(join(docsImgDir, file));
        result.pruned.push(file);
      }
    }
  }

  return result;
}

export function formatSyncReport(result: SyncResult, docsImgDir: string): { lines: string[]; warnings: string[] } {
  const lines: string[] = [`Copied ${result.copied.length} screenshot(s).`];
  const warnings: string[] = [];
  if (result.stale.length > 0) {
    if (result.pruned.length > 0) {
      lines.push(`Pruned ${result.pruned.length} stale screenshot(s): ${result.pruned.join(", ")}`);
    } else {
      warnings.push(`${result.stale.length} stale screenshot(s) in ${docsImgDir}: ${result.stale.join(", ")}`);
      warnings.push("Run with --prune to delete them.");
    }
  }
  return { lines, warnings };
}

#!/usr/bin/env bun
import { syncDocScreenshots, formatSyncReport } from "./sync-doc-screenshots";

const SCREENSHOTS_DIR = "cypress/screenshots/doc/doc-screenshots.cy.ts";
const DOCS_IMG_DIR = "doc/customer/docs/img";

const prune = process.argv.includes("--prune");
const result = await syncDocScreenshots({ screenshotsDir: SCREENSHOTS_DIR, docsImgDir: DOCS_IMG_DIR, prune });
const report = formatSyncReport(result, DOCS_IMG_DIR);
report.lines.forEach((l) => console.log(l));
report.warnings.forEach((w) => console.warn(`Warning: ${w}`));

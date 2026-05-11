#!/usr/bin/env bun
/**
 * Writes Apache-compatible .htaccess files for SPA routing (mod_rewrite).
 * Nginx ignores these; use alongside nginx try_files in Docker.
 *
 * Usage: bun scripts/write-spa-htaccess.ts <static-spa-root>
 * Example: bun scripts/write-spa-htaccess.ts api/public/static-spa
 */

import { mkdir, writeFile } from "fs/promises";
import path from "path";

const apps: { dir: string; rewriteBase: string }[] = [
  { dir: "tutor", rewriteBase: "/tutor/" },
  { dir: "enroll", rewriteBase: "/enroll/" },
  { dir: "verify", rewriteBase: "/verify/" },
];

function htaccessContent(rewriteBase: string): string {
  return `# Single-page app fallback (Apache + mod_rewrite). Nginx ignores this file.
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase ${rewriteBase}
  RewriteRule ^index\\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . index.html [L]
</IfModule>
`;
}

const rootArg = process.argv[2];

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`Usage: bun scripts/write-spa-htaccess.ts <static-spa-root>`);
  process.exit(0);
}

if (!rootArg) {
  console.error(`Usage: bun scripts/write-spa-htaccess.ts <static-spa-root>`);
  process.exit(1);
}

const root = path.resolve(rootArg);

for (const app of apps) {
  const dir = path.join(root, app.dir);
  const file = path.join(dir, ".htaccess");
  await mkdir(dir, { recursive: true });
  await writeFile(file, htaccessContent(app.rewriteBase), "utf8");
  console.log(`Wrote ${path.relative(process.cwd(), file)}`);
}

console.log("Done.");

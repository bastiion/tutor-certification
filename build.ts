#!/usr/bin/env bun
import plugin from "bun-plugin-tailwind";
import { existsSync } from "fs";
import { rm } from "fs/promises";
import path from "path";

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log(`
🏗️  Bun Build Script

Usage: bun run build.ts [options]

Common Options:
  --outdir <path>          Output directory (default: "dist")
  --minify                 Enable minification (or --minify.whitespace, --minify.syntax, etc)
  --sourcemap <type>      Sourcemap type: none|linked|inline|external
  --target <target>        Build target: browser|bun|node
  --format <format>        Output format: esm|cjs|iife
  --splitting              Enable code splitting
  --packages <type>        Package handling: bundle|external
  --public-path <path>     Public path for assets
  --env <mode>             Environment handling: inline|disable|prefix*
  --conditions <list>      Package.json export conditions (comma separated)
  --external <list>        External packages (comma separated)
  --banner <text>          Add banner text to output
  --footer <text>          Add footer text to output
  --define <obj>           Define global constants (e.g. --define.VERSION=1.0.0)
  --help, -h               Show this help message

Example:
  bun run build.ts --outdir=dist --minify --sourcemap=linked --external=react,react-dom
`);
  process.exit(0);
}

const toCamelCase = (str: string): string =>
  str.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

const parseValue = (value: string): any => {
  if (value === "true") return true;
  if (value === "false") return false;

  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d*\.\d+$/.test(value)) return parseFloat(value);

  if (value.includes(",")) return value.split(",").map(v => v.trim());

  return value;
};

function parseArgs(): Partial<Bun.BuildConfig> {
  // Dynamic CLI mapping; use a loose record so strict typing doesn't fight argv parsing.
  const config: Record<string, unknown> = {};
  const args = process.argv.slice(2);

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === undefined) continue;
    if (!arg.startsWith("--")) continue;

    if (arg.startsWith("--no-")) {
      const key = toCamelCase(arg.slice(5));
      config[key] = false;
      continue;
    }

    if (!arg.includes("=") && (i === args.length - 1 || args[i + 1]?.startsWith("--"))) {
      const key = toCamelCase(arg.slice(2));
      config[key] = true;
      continue;
    }

    let key: string;
    let value: string;

    if (arg.includes("=")) {
      [key, value] = arg.slice(2).split("=", 2) as [string, string];
    } else {
      key = arg.slice(2);
      value = args[++i] ?? "";
    }

    key = toCamelCase(key);

    const dot = key.indexOf(".");
    if (dot > 0) {
      const parentKey = key.slice(0, dot);
      const childKey = key.slice(dot + 1);
      const parent = (config[parentKey] as Record<string, unknown> | undefined) ?? {};
      parent[childKey] = parseValue(value);
      config[parentKey] = parent;
    } else {
      config[key] = parseValue(value);
    }
  }

  return config as Partial<Bun.BuildConfig>;
}

const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

console.log("\n🚀 Starting build process...\n");

const cliConfig = parseArgs();
const distRoot =
  typeof cliConfig.outdir === "string"
    ? path.resolve(process.cwd(), cliConfig.outdir)
    : path.join(process.cwd(), "dist");

const { outdir: _omitOutdir, publicPath: _omitPublicPath, ...buildOverrides } = cliConfig;

if (existsSync(distRoot)) {
  console.log(`🗑️ Cleaning previous build at ${distRoot}`);
  await rm(distRoot, { recursive: true, force: true });
}

const apps: {
  id: string;
  entry: string;
  /** Mirror of public URL prefix (e.g. /enroll/ for participant). */
  outSegment: string;
  publicPath: string;
}[] = [
  { id: "tutor", entry: "apps/tutor/index.html", outSegment: "tutor", publicPath: "/tutor/" },
  {
    id: "participant",
    entry: "apps/participant/index.html",
    outSegment: "enroll",
    publicPath: "/enroll/",
  },
  { id: "verify", entry: "apps/verify/index.html", outSegment: "verify", publicPath: "/verify/" },
];

const start = performance.now();
const outputRows: { File: string; Type: string; Size: string }[] = [];

for (const app of apps) {
  const entry = path.resolve(app.entry);
  const outdir = path.join(distRoot, app.outSegment);
  console.log(`📦 ${app.id} → ${path.relative(process.cwd(), outdir)} (publicPath ${app.publicPath})\n`);

  const result = await Bun.build({
    ...buildOverrides,
    entrypoints: [entry],
    outdir,
    publicPath: app.publicPath,
    plugins: [plugin],
    minify: true,
    target: "browser",
    sourcemap: "linked",
    define: {
      "process.env.NODE_ENV": JSON.stringify("production"),
    },
  });

  if (!result.success) {
    console.error(result.logs);
    process.exit(1);
  }

  for (const output of result.outputs) {
    outputRows.push({
      File: path.relative(process.cwd(), output.path),
      Type: output.kind,
      Size: formatFileSize(output.size),
    });
  }
}

const end = performance.now();

console.table(outputRows);
const buildTime = (end - start).toFixed(2);

console.log(`\n✅ Build completed in ${buildTime}ms\n`);

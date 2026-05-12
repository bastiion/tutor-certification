import path from "node:path";

export interface ParsedCli {
  auto: boolean;
  /** Resolved absolute path to `.env` file, or null to print to stdout only */
  outFile: string | null;
  help: boolean;
}

export function parseCli(argv: string[]): ParsedCli {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    return { auto: false, outFile: null, help: true };
  }

  const auto = args.includes("--auto");
  let outFile: string | null = null;
  const outIdx = args.findIndex((a) => a === "--out" || a.startsWith("--out="));
  if (outIdx >= 0) {
    const eq = args[outIdx]!.indexOf("=");
    if (eq > 0) {
      outFile = args[outIdx]!.slice(eq + 1).trim();
    } else {
      outFile = args[outIdx + 1]?.trim() ?? "";
    }
  }

  if (outFile !== null && outFile.length === 0) {
    throw new Error("--out requires a path (file or directory)");
  }

  let resolved: string | null = null;
  if (outFile !== null && outFile.length > 0) {
    const abs = path.resolve(outFile);
    const base = path.basename(abs);
    if (base === ".env" || abs.endsWith(".env")) {
      resolved = abs;
    } else {
      // Treat as directory
      resolved = path.join(abs, ".env");
    }
  }

  return { auto, outFile: resolved, help: false };
}

export function helpText(program: string): string {
  return `
${program} — generate deployment secrets and a docker-compose \`.env\` file.

Usage:
  ${program} [options]

Options:
  --auto       Generate cryptographic secrets only; use placeholders for hostnames,
               public URLs, SMTP, and image tag (non-interactive).
  --out <path> Write \`.env\` to this path. If <path> is a directory, writes <path>/.env.
               If omitted, prints the full file to stdout.

  -h, --help   Show this message.

Docker (interactive, TTY — override entrypoint so the app image runs the wizard instead of nginx/php):
  docker run --rm -it \\
    -v "$PWD:/out" \\
    --entrypoint /usr/local/bin/env-wizard \\
    <image:tag> \\
    --out /out

Docker (non-interactive secrets, write to mounted dir — stdout stays empty except “Wrote …” on stderr):
  docker run --rm \\
    -v "$PWD:/out" \\
    --entrypoint /usr/local/bin/env-wizard \\
    <image:tag> \\
    --auto --out /out/.env
`.trim();
}

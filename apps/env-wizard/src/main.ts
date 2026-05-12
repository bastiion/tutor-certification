#!/usr/bin/env bun
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCli, helpText } from "./cli.ts";
import { defaultEnvForAuto, renderEnvFile } from "./envTemplate.ts";
import { promptForFields } from "./interactive.ts";
import { generateSecrets } from "./secrets.ts";

const program = path.basename(process.argv[1] ?? "env-wizard");

async function main(): Promise<void> {
  let parsed;
  try {
    parsed = parseCli(process.argv);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    console.error(helpText(program));
    process.exit(2);
  }

  if (parsed.help) {
    console.log(helpText(program));
    process.exit(0);
  }

  if (!parsed.auto && !process.stdin.isTTY) {
    console.error(
      "Interactive mode requires a TTY. Re-run with `docker run -it ...`, or use `--auto` to emit secrets non-interactively.",
    );
    process.exit(2);
  }

  const secrets = await generateSecrets();

  const fields = parsed.auto
    ? defaultEnvForAuto(secrets)
    : await promptForFields(secrets);

  const content = renderEnvFile(fields);

  if (parsed.outFile !== null) {
    await mkdir(path.dirname(parsed.outFile), { recursive: true });
    await writeFile(parsed.outFile, content, "utf8");
    console.error(`Wrote ${parsed.outFile}`);
  } else {
    // No --out: print full .env for copy/paste (may contain secrets).
    console.log(content);
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});

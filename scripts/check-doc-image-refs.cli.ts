#!/usr/bin/env bun
import { checkDocImageRefs, formatCheckReport } from "./check-doc-image-refs";

const DOCS_DIR = "doc/customer/docs";

const docsDir = process.argv[2] ?? DOCS_DIR;
const result = await checkDocImageRefs(docsDir);
const report = formatCheckReport(result);
console.log(report.summary);
report.errors.forEach((e) => console.error(e));
if (report.exitCode !== 0) process.exit(report.exitCode);

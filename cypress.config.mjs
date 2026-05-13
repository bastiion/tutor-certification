import { defineConfig } from "cypress";
import { readdir } from "node:fs/promises";
import {
  enrollAs,
  mintSessionCredential,
  signRevocationDocument,
  writeEnrollmentQrPng,
} from "./e2e/support/tasks/apiCryptoTasks.bundle.mjs";

const baseUrl =
  process.env.CYPRESS_BASE_URL && process.env.CYPRESS_BASE_URL.trim() !== ""
    ? process.env.CYPRESS_BASE_URL
    : "http://localhost:3000";

const isDocMode = process.env.CYPRESS_DOC_MODE === "1";

export default defineConfig({
  e2e: {
    baseUrl,
    specPattern: "e2e/**/*.cy.ts",
    supportFile: "e2e/support/e2e.ts",
    video: false,
    ...(isDocMode && {
      viewportWidth: 1280,
      viewportHeight: 800,
      screenshotsFolder: "cypress/screenshots/doc",
    }),
    env: {
      TUTOR_API_TOKEN: process.env.TUTOR_API_TOKEN ?? "",
      TUTOR_EMAIL: process.env.TUTOR_EMAIL ?? "tutor@example.test",
    },
    setupNodeEvents(on) {
      on("task", {
        mintSessionCredential(opts) {
          return mintSessionCredential(opts ?? {});
        },
        signRevocationDocument(opts) {
          return signRevocationDocument(opts);
        },
        enrollAs(opts) {
          return enrollAs(opts);
        },
        writeEnrollmentQrPng(opts) {
          return writeEnrollmentQrPng(opts);
        },
        async assertScreenshotsExist(expectedNames) {
          const dir = isDocMode
            ? "cypress/screenshots/doc/doc-screenshots.cy.ts"
            : "cypress/screenshots";
          let files;
          try {
            files = await readdir(dir);
          } catch {
            throw new Error(`Screenshots directory not found: ${dir}`);
          }
          const fileSet = new Set(files.map((f) => f.replace(/\.png$/, "")));
          const missing = expectedNames.filter((n) => !fileSet.has(n));
          if (missing.length > 0) {
            throw new Error(`Missing screenshots: ${missing.join(", ")}`);
          }
          return null;
        },
      });
    },
  },
});

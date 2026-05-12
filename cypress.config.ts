import { defineConfig } from "cypress";
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

export default defineConfig({
  e2e: {
    baseUrl,
    specPattern: "e2e/**/*.cy.ts",
    supportFile: "e2e/support/e2e.ts",
    video: false,
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
      });
    },
  },
});

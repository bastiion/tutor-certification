import { defineConfig } from "cypress";
import { mintSessionCredential, signRevocationDocument } from "./e2e/support/tasks/apiCryptoTasks.ts";

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
    },
    setupNodeEvents(on) {
      on("task", {
        mintSessionCredential(opts) {
          return mintSessionCredential(opts ?? {});
        },
        signRevocationDocument(opts) {
          return signRevocationDocument(opts);
        },
      });
    },
  },
});

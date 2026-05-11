import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:3000",
    specPattern: "e2e/**/*.cy.ts",
    supportFile: false,
    video: false,
  },
});

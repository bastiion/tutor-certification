const { defineConfig } = require("cypress");

const baseUrl =
  process.env.CYPRESS_BASE_URL && process.env.CYPRESS_BASE_URL.trim() !== ""
    ? process.env.CYPRESS_BASE_URL
    : "http://localhost:3000";

module.exports = defineConfig({
  e2e: {
    baseUrl,
    specPattern: "e2e/**/*.cy.ts",
    supportFile: "e2e/support/e2e.ts",
    video: false,
  },
});

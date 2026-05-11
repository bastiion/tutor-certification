/// <reference types="cypress" />

/**
 * Forward the in-app browser console to the Node process running Cypress so
 * failures and `console.*` output show in the terminal (dev + Compose runs).
 */
const methods = ["log", "info", "warn", "error", "debug"] as const;

Cypress.on("window:before:load", (win) => {
  for (const method of methods) {
    const original = win.console[method].bind(win.console);
    win.console[method] = (...args: unknown[]) => {
      console.log(`[browser:${method}]`, ...args);
      original(...args);
    };
  }
});

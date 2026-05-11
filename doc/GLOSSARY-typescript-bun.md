# Glossary — TypeScript, Bun, and frontend tooling here

Quick orientation if you mainly know PHP or classic JavaScript (**no** deep TS theory required).

---

## JavaScript vs TypeScript

- **JavaScript (JS)** is the language browsers (and Bun/Node) run.
- **TypeScript (TS)** is JS **plus optional static types**. Files often end in **`.ts`** (logic) or **`.tsx`** (logic + UI markup in **JSX**). The dev server / bundler strips types and emits JS.

In this repo, UI app code lives under [`apps/`](../apps/) (workspaces) and shared libraries under [`packages/`](../packages/).

---

## Bun

**Bun** is a single tool that plays several roles at once: **JS/TS runtime** (like Node), **package manager** (like npm), and **bundler/dev server** with hot reload.

- **`bun install`** installs dependencies (see root [`package.json`](../package.json)).
- **`bun dev`** runs the dev server (see [`package.json`](../package.json) `dev` script).
- **`bun run <script>`** runs a named script from `package.json`.

This project standardizes on Bun instead of Node/npm for the frontend (see [`CLAUDE.md`](../CLAUDE.md)).

---

## `package.json`

The **manifest** for the JavaScript/TypeScript part of the repo: project name, scripts (`dev`, `build`, `cypress`, …), and dependency lists. Analog to PHP’s **`composer.json`**, but for the Bun/Node ecosystem.

---

## `bun.lock`

The **lockfile** for Bun installs—like **`composer.lock`** for PHP. Keeps installs reproducible; commit it.

---

## React

A **UI library**: you build screens from **components** (functions that return **JSX**). State and events update what the user sees without hand-writing lots of DOM code.

---

## Tailwind CSS

A **utility-first CSS** setup: you style elements with small class names in JSX instead of maintaining large separate CSS files for every component. A **Bun plugin** wires Tailwind into the build (see [`bunfig.toml`](../bunfig.toml) and dev server config).

---

## Zod

A **schema** library for JS/TS: describe the shape you expect (e.g. form input) and get **validation** with clear errors. Used to keep client-side data sane before talking to an API.

---

## `tsconfig.json`

Tells the **TypeScript compiler** (and your editor) how strict to be, which syntax level to allow, and path aliases (e.g. `@ikwsd/crypto`). It does **not** replace a test runner; it’s for types and IDE support.

---

## Cypress

A **browser end-to-end (E2E) test** runner: scripts drive a real browser (clicks, typing, navigation) against your running app.

- Specs live under [`e2e/`](../e2e/).
- **`cypress.config.cjs`** sets **`baseUrl`** (here: `http://localhost:3000`) so tests know where the app is.
- On **NixOS**, run Cypress **inside `nix develop`** so it uses the Nix-packaged Electron binary (avoids broken dynamic linking).

---

## Vite / webpack?

This template does **not** use Vite or webpack for the main dev path; **Bun’s bundler** and dev server handle builds and HMR ([`server.ts`](../server.ts)).

---

## `build.ts`

A **custom build script** (Bun) that produces static output for production (under `dist/tutor/`, `dist/enroll/`, `dist/verify/`). Invoked via `bun run build` from [`package.json`](../package.json).
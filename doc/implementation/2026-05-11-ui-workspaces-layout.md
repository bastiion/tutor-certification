# UI monorepo layout (Bun workspaces)

**Date:** 2026-05-11

## Scope delivered

- **Bun workspaces** with `apps/*` and `packages/*`, plus a **shared dependency catalog** in the root `package.json` for version pinning (`catalog:` references in workspace packages).
- **Three UI apps** (scaffold only where not yet product-complete):
  - `@ikwsd/tutor` — existing certificate / form UI moved from former root `src/` into `apps/tutor/` (history preserved via `git mv`).
  - `@ikwsd/participant` — placeholder enrollment app under URL prefix `/enroll/`.
  - `@ikwsd/verify` — placeholder verification app under `/verify/`.
- **Shared package** `@ikwsd/crypto` under `packages/crypto/` with a deliberate placeholder API until browser crypto is implemented.
- **Dev server** at repo root: [`server.ts`](../../server.ts) routes `/` → `/tutor/` and serves each SPA under the planned path prefixes.
- **Production build**: [`build.ts`](../../build.ts) emits `dist/tutor/`, `dist/enroll/`, and `dist/verify/` with matching `publicPath` values.
- **Cypress** smoke test updated to open the tutor UI at `/tutor/` (see [`e2e/certificate-form.cy.ts`](../../e2e/certificate-form.cy.ts)).

## Intentional non-goals (this slice)

- No nginx/Docker changes to serve static `dist/` from the PHP stack yet (production wiring can follow when assets are deployed).
- No participant/verify product flows or real `@ikwsd/crypto` implementations.

## Verification (local)

```bash
nix develop -c bun install
nix develop -c bun run typecheck
nix develop -c bun run build
nix develop -c bun dev   # http://localhost:3000/tutor/ (default port)
```

Cypress (from dev shell on NixOS):

```bash
nix develop -c bun dev          # terminal 1
nix develop -c bun run cypress  # terminal 2
```

# Compose static SPAs and dual Cypress targets

**Date:** 2026-05-11

## What shipped

- **`bun run build:compose`** — builds all three Bun SPAs into **`api/public/static-spa/`** (gitignored) with **`publicPath`** `/tutor/`, `/enroll/`, `/verify/`, then writes **per-app `.htaccess`** (Apache SPA fallback; [`scripts/write-spa-htaccess.ts`](../../scripts/write-spa-htaccess.ts)).
- **Nginx** ([`docker/nginx/api-default.conf`](../../docker/nginx/api-default.conf)) — `location ^~` for `/tutor/`, `/enroll/`, `/verify/` with `root` + `try_files` to each app’s `index.html`.
- **`api/public/info.php`** — navigation hub (same-host static links + Bun dev links); full **`phpinfo()`** via **`?phpinfo=1`**.
- **Cypress** — `baseUrl` from **`CYPRESS_BASE_URL`** (default `http://localhost:3000`); **`e2e/support/e2e.ts`** mirrors browser `console.*` to the terminal; **`cypress:compose`** targets **`http://localhost:7123`**.

## CI sketch

Build UI → start Compose → run `CYPRESS_BASE_URL=http://localhost:7123 cypress run` (or the service hostname inside the job network).

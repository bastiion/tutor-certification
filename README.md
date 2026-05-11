# Teilnahmebescheinigungen

Hosted-style service **in development**: digitally signed participation certificates for online courses, time-limited enrollment links, tutor-side crypto in the browser, and minimal server-side state ([concept](doc/plan/key-signing-courses-plan.md)). The **frontend** is a **Bun workspaces** monorepo with three SPA entrypoints and a shared package; the **backend** is a **PHP** API scaffold with Docker-based tooling.

---

## Status

Product flows (enrollment, signing, revocation, verification) are **not fully implemented** yet; the codebase includes a frontend template, PHP API bootstrap, tests, static analysis, and local mail capture for development. See [`doc/plan/key-signing-courses-plan-implementation.md`](doc/plan/key-signing-courses-plan-implementation.md) for the intended shape and shipped notes under [`doc/implementation/`](doc/implementation/).

---

## For organizers, tutors, and participants

This section describes the **intended experience** once the roadmap is implemented. A **minimal production-shaped Docker image** (single container, Bun-built SPAs + PHP) is published on **version tags** to GHCR — see **[Production Docker image](#production-docker-image-version-tags)** and [`deploy/README.md`](deploy/README.md).

| Role | Intended use (target state) |
|------|------------------------------|
| **Institute / tutor** | Creates a session, shares a single time-limited link in the course channel. Sensitive keys stay out of opaque server custody (handled in-browser or local tooling per plan). Receives issuance notifications for audit (e.g. email). Can revoke certificates if needed. |
| **Participant** | Opens the link while it is valid, enters their details (and optional email where supported), downloads or prints a certificate artifact (e.g. JSON + QR / print layout). |
| **Third party** | Verifies a certificate using published keys and cryptographic checks; online checks may hit a revocation endpoint. |

**Today:** end users still rely on whoever runs this software. Operators can **`docker pull ghcr.io/…`** for a tagged release and follow **[Production Docker image](#production-docker-image-version-tags)** / [`deploy/README.md`](deploy/README.md). Developers use the stacks below.

For **deep product and crypto design**, see [Concept — Participation Certificate Service](doc/plan/key-signing-courses-plan.md).

---

## For developers

### Prerequisites

| Tool | Purpose |
|------|---------|
| [Bun](https://bun.sh) | Frontend dev server, build, Cypress runner glue |
| [Docker](https://docs.docker.com/get-docker/) + Compose | PHP-FPM, nginx, Mailpit (`bun run` backend scripts invoke Compose) |
| [Nix](https://nixos.org/) *(recommended)* | Reproducible shell: Bun, Cypress binary, PHP 8.4, Composer, `docker-compose`; avoids Electron/static-link quirks on NixOS |

Without Nix, install Bun and Docker yourself and run the same `bun` / `docker compose` commands from your PATH.

Enter the shell (optional but recommended on NixOS):

```bash
nix develop
```

---

### Repository layout

| Path | Contents |
|------|----------|
| [`apps/tutor`](apps/tutor) | Tutor / certificate UI (current main React app) |
| [`apps/participant`](apps/participant) | Enrollment SPA scaffold (URL prefix `/enroll/` in dev) |
| [`apps/verify`](apps/verify) | Verification SPA scaffold (URL prefix `/verify/` in dev) |
| [`packages/crypto`](packages/crypto) | Shared `@bastiion/crypto` workspace package (Stage 1: libsodium + WebCrypto HKDF, see [`doc/implementation/`](doc/implementation/)) |
| [`server.ts`](server.ts) | Bun dev server: routes `/tutor/`, `/enroll/`, `/verify/` |
| `api/public/static-spa/` | Pre-built SPAs for Docker/nginx (from `bun run build:compose`, gitignored) |
| [`api/`](api/) | Composer project: bootstrap PHP code, Pest tests, PHPStan, `public/index.php` |
| [`docker/`](docker/) | Custom PHP dev image + nginx virtual host (`docker/php`, `docker/nginx`) |
| [`docker/production/`](docker/production) | Multi-stage **production** image (nginx + PHP-FPM, port **8080**); built by the release workflow |
| [`deploy/`](deploy) | Traefik-oriented **one-shot compose** + `.env.example` (attached to GitHub Releases) |
| [`e2e/`](e2e/) | Cypress specs |
| [`doc/plan/`](doc/plan/) | Authoritative roadmap and implementation plan |
| [`doc/implementation/`](doc/implementation/) | Shipped-scope notes |

---

### Frontend (Bun + React + Tailwind)

Root [`package.json`](package.json) declares **workspaces** (`apps/*`, `packages/*`) and a **catalog** for shared dependency versions (referenced as `catalog:` inside workspace packages).

```bash
nix develop -c bun install
nix develop -c bun dev
```

- Dev server default: http://localhost:3000 (`PORT` overrides the port). **`/` redirects to `/tutor/`**. Apps: **`/tutor/`** (tutor), **`/enroll/`** (participant scaffold), **`/verify/`** (verify scaffold).
- **Browser logs in the terminal (dev):** [`server.ts`](server.ts) enables `development.console` when `NODE_ENV` is not `production`. Run plain **`bun dev`** so client `console.*` is forwarded to the Bun terminal (avoid `NODE_ENV=production` for local UI work).
- **Production-style bundles (repo root):** `nix develop -c bun run build` → [`build.ts`](build.ts) writes **`dist/tutor/`**, **`dist/enroll/`**, **`dist/verify/`** (same as before).
- **Compose / PHP+nginx staging tree:** **`bun run build:compose`** builds into **`api/public/static-spa/`** (gitignored), adds **`.htaccess`** per app for Apache-style hosts, and matches the path prefixes nginx uses.
- Typecheck: `nix develop -c bun run typecheck`.

---

### Backend (`api/` + Docker)

Raise the stack (**PHP-FPM, nginx, Mailpit**):

```bash
nix develop -c bun run docker:down   # optional clean slate for containers
nix develop -c bun run docker:up
nix develop -c bun run composer:backend   # first time or after lockfile changes
```

| Service | URL / port |
|---------|-------------|
| App via nginx | http://localhost:7123/ (front controller → `api/public/index.php`) |
| Developer hub | http://localhost:7123/dev/ (shortcuts API, Mailpit, built SPAs, coverage) |
| HTML coverage report (generate first) | http://localhost:7123/coverage/ |
| Local dev info + links | http://localhost:7123/info.php (static SPAs, Bun dev URLs; `?phpinfo=1` for full `phpinfo()`) |
| Static SPAs (after `bun run build:compose`) | http://localhost:7123/tutor/, http://localhost:7123/enroll/, http://localhost:7123/verify/ |
| Mailpit UI | http://localhost:8025 |
| SMTP (Mailpit) | Host `localhost` port `1025` from the host; hostname `mailpit` from containers |

`vendor/` is stored in the Compose volume `api_vendor` (see [`docker-compose.yml`](docker-compose.yml)); `composer:backend` populates it. Source under `api/` is bind-mounted, so PHP code changes apply on the **next request** without rebuilding the image unless you change the Dockerfile or extensions.

Inside the **`php`** service, `MAILPIT_INTEGRATION=1`, `MAILPIT_API_BASE`, `SMTP_*` are set so integration tests can talk to Mailpit.

**Useful Composer scripts** (prefer running through Bun so they execute in Docker):

| Command | Effect |
|---------|--------|
| `bun run composer:backend` | `composer install` in container |
| `bun run test:backend` | Pest |
| `bun run test:backend:coverage` | Pest + coverage + `--min=90` for `api/src/` |
| `bun run analyse:backend` | PHPStan |

**Without Docker**, from `nix develop` you can use host `composer`/`php`:

```bash
cd api && composer install
MAILPIT_INTEGRATION=0 composer test    # skips Mailpit integration unless you point it at Mailpit
composer analyse
```

Coverage artifacts (when generated): [`api/coverage/html`](api/coverage) and `api/coverage/clover.xml`.

---

### End-to-end tests (Cypress)

[`cypress.config.ts`](cypress.config.ts) sets **`baseUrl`** from **`CYPRESS_BASE_URL`**, default **`http://localhost:3000`**. Specs use path-only URLs (e.g. **`/tutor/`**) so the same tests run against **Bun dev** or **Docker nginx + static build**.

| Target | When | Command (examples) |
|--------|------|---------------------|
| Hot reload (Bun) | `bun dev` on port 3000 | `nix develop -c bun run cypress` |
| Staging-like (Compose) | `bun run build:compose` + `docker compose up`, nginx on 7123 | `nix develop -c bun run cypress:compose` |

**Compose Cypress scripts** (`cypress:compose`, `cypress:compose:open`) load [`docker/php/dev.env`](docker/php/dev.env) before starting Cypress so **`TUTOR_API_TOKEN`**, **`SERVER_BOX_KEYPAIR_BASE64`**, and related vars match the PHP API container (required for `api-flow.cy.ts` tasks).

Optional: `CYPRESS_BASE_URL=http://127.0.0.1:7123 cypress run` for any host/port (you must still export the same secrets yourself if not using those scripts).

Browser **`console.log` / `warn` / `error`** during tests is echoed to the terminal via [`e2e/support/e2e.ts`](e2e/support/e2e.ts) with a **`[browser:…]`** prefix.

On **NixOS**, always run Cypress from the dev shell so the Nix Electron binary is used (see [.cursor/rules/cypress-test-runner.mdc](.cursor/rules/cypress-test-runner.mdc)):

```bash
# Against Bun dev (terminal 1: bun dev)
nix develop -c bun run cypress
nix develop -c bun run cypress:open

# Against nginx + static SPAs (terminal 1: docker compose up; run build:compose first)
nix develop -c bun run cypress:compose
nix develop -c bun run cypress:compose:open
```

**CI:** build assets, start the stack, set **`CYPRESS_BASE_URL`** to the nginx URL the job can reach, then run **`cypress run`**.

---

### Environment hints

| Area | Variables |
|------|-----------|
| Frontend dev server | `PORT` (defaults to `3000`); avoid `NODE_ENV=production` if you want Bun to forward browser console to the terminal |
| Cypress | `CYPRESS_BASE_URL` (overrides default `http://localhost:3000`) |
| PHP / Pest (Docker) | `MAILPIT_INTEGRATION`, `MAILPIT_API_BASE`, `SMTP_HOST`, `SMTP_PORT` (set in Compose for `php`) |
| Secrets | Prefer untracked `.env` files; see [.gitignore](.gitignore) |

---

### Quality checklist (developers)

Rough order before pushing backend changes:

```bash
nix develop -c bun run test:backend:coverage
nix develop -c bun run analyse:backend
```

Frontend: `bun run typecheck`, `bun run build` or `bun run build:compose`; Cypress against dev (`cypress`) or Compose (`cypress:compose`) when UI paths change.

---

### Production Docker image (version tags)

Pushing a **semver tag** matching `v*.*.*` runs [`.github/workflows/release.yml`](.github/workflows/release.yml): it builds [`docker/production/Dockerfile`](docker/production/Dockerfile), smoke-tests HTTP routes, pushes **`ghcr.io/<lowercase-owner>/<repo>:<tag>`** and **`:latest`**, and publishes a GitHub Release with [`deploy/docker-compose.traefik.yml`](deploy/docker-compose.traefik.yml), [`deploy/.env.example`](deploy/.env.example), and [`deploy/README.md`](deploy/README.md).

```bash
docker pull ghcr.io/bastiion/tutor-certification:v0.1.0
docker run --rm -p 8080:8080 ghcr.io/bastiion/tutor-certification:v0.1.0
```

Traefik-oriented compose and GHCR authentication for private packages: **[`deploy/README.md`](deploy/README.md)**.

---

## CI and local rehearsal

Long-form reference (jobs, artifacts, Dependabot, `act`): **[CI.md](CI.md)**.

**On GitHub**: workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on pushes to `main` and on pull requests:

- **workflow-lint** — [actionlint](https://github.com/rhysd/actionlint) on workflow files
- **frontend** — `bun install --frozen-lockfile`, `typecheck`, `build`, `build:compose`, uploads **`static-spa`**
- **backend** — `docker compose` PHP image; Pest coverage + **`--min=90`**, Mailpit integration, JUnit + Clover + HTML uploads
- **compose-smoke-and-e2e** — restores SPA + HTML coverage artifacts, **`docker compose up`**, curls key routes, **`cypress:compose`** (Chrome)
- **security** — `bun audit`, **`composer audit`**, optional Trivy fs scan (non-blocking exit code)
- **ci-summary** — job table into the Actions step summary + fails the workflow if any job did not succeed

GitHub **CodeQL** / code scanning is intentionally disabled (no workflow); you can add **`codeql.yml`** and turn on code scanning in repo settings after the repository is public.

Dependabot updates: [`.github/dependabot.yml`](.github/dependabot.yml).

**Locally (everything that does not require GitHub):**

```bash
nix develop -c bun run ci:local
```

Requires Docker for the backend part; matches most of CI except Cypress (add manual `docker compose up` + `cypress:compose`) and security scans beyond audits.

**Rehearse workflows with [act](https://github.com/nektos/act)** (provided in **`nix develop`**):

```bash
nix develop -c bun run ci:act:list
nix develop -c bun run ci:act
```

`act` uses Docker heavily; coverage and Compose jobs succeed only if Docker has enough RAM and pulls succeed. Treat `act` as *syntax + runner sanity*; GitHub-only security UX differs from local runs.

---

## Further reading

- [Concept — participation certificates & cryptography](doc/plan/key-signing-courses-plan.md)
- [Monorepo / SPA / PHP implementation plan](doc/plan/key-signing-courses-plan-implementation.md)
- [Bootstrap log — PHP tooling & Mailpit](doc/implementation/2026-05-11-php-backend-bootstrap.md)
- [UI workspaces layout](doc/implementation/2026-05-11-ui-workspaces-layout.md)
- [GitHub CI + act + Dependabot](doc/implementation/2026-05-11-github-ci-and-act.md)
- [Production Docker image + GHCR release](doc/implementation/2026-05-11-production-docker-release.md)
- [CI reference (pipelines, act, artifacts)](CI.md)
- [Glossaries](doc/GLOSSARY.md) — PHP, TypeScript/Bun, and Cryptography guides for beginners

# Teilnahmebescheinigungen

Hosted-style service **in development**: digitally signed participation certificates for online courses, time-limited enrollment links, tutor-side crypto in the browser, and minimal server-side state ([concept](doc/plan/key-signing-courses-plan.md)). This repository mixes a **Bun/React** SPA with a **PHP** API scaffold and Docker-based tooling.

---

## Status

Product flows (enrollment, signing, revocation, verification) are **not fully implemented** yet; the codebase includes a frontend template, PHP API bootstrap, tests, static analysis, and local mail capture for development. See [`doc/plan/key-signing-courses-plan-implementation.md`](doc/plan/key-signing-courses-plan-implementation.md) for the intended shape and shipped notes under [`doc/implementation/`](doc/implementation/).

---

## For organizers, tutors, and participants

This section describes the **intended experience** once the roadmap is implemented. There is **no production deployment guide** here yet.

| Role | Intended use (target state) |
|------|------------------------------|
| **Institute / tutor** | Creates a session, shares a single time-limited link in the course channel. Sensitive keys stay out of opaque server custody (handled in-browser or local tooling per plan). Receives issuance notifications for audit (e.g. email). Can revoke certificates if needed. |
| **Participant** | Opens the link while it is valid, enters their details (and optional email where supported), downloads or prints a certificate artifact (e.g. JSON + QR / print layout). |
| **Third party** | Verifies a certificate using published keys and cryptographic checks; online checks may hit a revocation endpoint. |

**Today:** there is nothing to “install” or “visit” as an end user without running the developer stack below. The running SPA is mainly for iteration; the public PHP entrypoint under Docker returns a small JSON bootstrap response for connectivity checks.

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
| [`src/`](src/) | Bun dev server (`src/index.ts`), React app, Tailwind |
| [`api/`](api/) | Composer project: bootstrap PHP code, Pest tests, PHPStan, `public/index.php` |
| [`docker/`](docker/) | Custom PHP image, nginx virtual host |
| [`e2e/`](e2e/) | Cypress specs |
| [`doc/plan/`](doc/plan/) | Authoritative roadmap and implementation plan |
| [`doc/implementation/`](doc/implementation/) | Shipped-scope notes |

---

### Frontend (Bun + React + Tailwind)

```bash
nix develop -c bun install
nix develop -c bun dev
```

- Default URL: http://localhost:3000 (`PORT` overrides the dev server port.)
- Production build: `nix develop -c bun run build` (runs [`build.ts`](build.ts)).

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
| Developer hub | http://localhost:7123/dev/ (shortcuts API, Mailpit, frontend, coverage URL) |
| HTML coverage report (generate first) | http://localhost:7123/coverage/ |
| PHP `phpinfo()` | http://localhost:7123/info.php |
| Mailpit UI | http://localhost:8025 |
| SMTP (Mailpit) | Host `localhost` port `1025` from the host; hostname `mailpit` from containers |

`vendor/` is stored in the Compose volume `api_vendor` (see [`docker-compose.yml`](docker-compose.yml)); `composer:backend` populates it. Source under `api/` is bind-mounted, so PHP code changes apply on the **next request** without rebuilding the image unless you change the Dockerfile or extensions.

Inside the **`php`** service, `MAILPIT_INTEGRATION=1`, `MAILPIT_API_BASE`, `SMTP_*` are set so integration tests can talk to Mailpit.

**Useful Composer scripts** (prefer running through Bun so they execute in Docker):

| Command | Effect |
|---------|--------|
| `bun run composer:backend` | `composer install` in container |
| `bun run test:backend` | Pest |
| `bun run test:backend:coverage` | Pest + coverage + `--min=100` for `src/` |
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

Cypress expects the frontend at `http://localhost:3000` (see [`cypress.config.cjs`](cypress.config.cjs)). On **NixOS**, always run Cypress from the dev shell so the Nix Electron binary is used (see [.cursor/rules/cypress-test-runner.mdc](.cursor/rules/cypress-test-runner.mdc)):

```bash
nix develop -c bun dev                 # terminal 1
nix develop -c bun run cypress         # terminal 2, headless

nix develop -c bun run cypress:open    # interactive UI
```

---

### Environment hints

| Area | Variables |
|------|-----------|
| Frontend dev server | `PORT` (defaults to `3000`) |
| PHP / Pest (Docker) | `MAILPIT_INTEGRATION`, `MAILPIT_API_BASE`, `SMTP_HOST`, `SMTP_PORT` (set in Compose for `php`) |
| Secrets | Prefer untracked `.env` files; see [.gitignore](.gitignore) |

---

### Quality checklist (developers)

Rough order before pushing backend changes:

```bash
nix develop -c bun run test:backend:coverage
nix develop -c bun run analyse:backend
```

Frontend: rely on existing TypeScript/`bun dev` workflows; Cypress when UI paths change.

---

## Further reading

- [Concept — participation certificates & cryptography](doc/plan/key-signing-courses-plan.md)
- [Monorepo / SPA / PHP implementation plan](doc/plan/key-signing-courses-plan-implementation.md)
- [Bootstrap log — PHP tooling & Mailpit](doc/implementation/2026-05-11-php-backend-bootstrap.md)
- Frontend conventions: [`CLAUDE.md`](CLAUDE.md) (Bun-first tooling)

# Production deploy (Docker)

The release workflow builds a **single image** (nginx + PHP-FPM, port **8080**) and pushes it to **GitHub Container Registry**. Each GitHub Release attaches this folder so you can copy it to a host without cloning the repo.

## Pull and run (smoke test)

Default image namespace matches this repository; override only if you fork or republish.

```bash
docker pull ghcr.io/bastiion/tutor-certification:v0.1.0
docker run --rm -p 8080:8080 --env-file your.env ghcr.io/bastiion/tutor-certification:v0.1.0
```

Bare **`/`** hits the PHP router and returns a JSON **`not_found`** (there is no `GET /`). Use **`/api/health`** for a readiness JSON probe, **`/tutor/`**, **`/enroll/`**, **`/verify/`** for the SPAs (`GET /api/openapi.json` for spec).

Dev-only paths are **not** served in production (`/info.php`, `/dev/`, `/coverage/` → `404`).

## Health checks (`/api/health`)

The **`GET /api/health`** route returns JSON `{ "ok": true, ... }` and exercises the normal Slim bootstrap (same as compose).

| Mechanism | Where |
|-----------|--------|
| **Dockerfile `HEALTHCHECK`** | [`docker/production/Dockerfile`](docker/production/Dockerfile) — `wget --spider http://127.0.0.1:8080/api/health` every 30s (after `start-period`). Applies to `docker run` and any orchestrator that reads image health. |
| **Compose `healthcheck`** | [`deploy/docker-compose.direct.yml`](deploy/docker-compose.direct.yml) and [`deploy/docker-compose.traefik.yml`](deploy/docker-compose.traefik.yml) — same probe; `docker compose ps` shows `healthy`. |

The image installs **`wget`** for these probes. From the host: `curl -fsS https://your-host/api/health` (or via port mapping).

**Note:** The container must receive the usual API environment variables (see `.env.example`); an unconfigured `docker run` without `--env-file` will not pass health.

## Create `.env` with the image’s env wizard

The production image ships a static helper at `/usr/local/bin/env-wizard` (Bun `--compile` bundle). It generates `SERVER_BOX_KEYPAIR_BASE64`, `TOKEN_HMAC_KEY_BASE64`, and `TUTOR_API_TOKEN`.

### Convenience script (`env-wizard.sh`)

From the repo root (or on a host after copying the `deploy/` folder):

```bash
chmod +x deploy/env-wizard.sh   # once
./deploy/env-wizard.sh            # interactive → writes deploy/.env
./deploy/env-wizard.sh --auto     # non-interactive secrets + placeholders → deploy/.env
```

The script mounts this `deploy/` directory at `/out` in the container, so the default is **`--out /out/.env`**. It uses `REGISTRY_IMAGE` and `IMAGE_TAG` from **`deploy/.env`** if that file already exists; otherwise defaults to **`ghcr.io/bastiion/tutor-certification:staging`** (same tag as `build-and-copy-production-docker.sh`). Pass any other flags straight through (e.g. `./deploy/env-wizard.sh -- --help`).

**Non-interactive** (CI, no TTY) — writes secrets and placeholders; does **not** prompt for hostname or SMTP:

```bash
mkdir -p deploy/out
docker run --rm \
  -v "$PWD/deploy/out:/out" \
  --entrypoint /usr/local/bin/env-wizard \
  ghcr.io/bastiion/tutor-certification:v0.1.0 \
  --auto --out /out/.env
```

**Interactive** (full prompts) — requires `-it`:

```bash
docker run --rm -it \
  -v "$PWD/deploy/out:/out" \
  --entrypoint /usr/local/bin/env-wizard \
  ghcr.io/bastiion/tutor-certification:v0.1.0 \
  --out /out/.env
```

If you used raw `docker run` with `deploy/out`, merge that file into **`deploy/.env`** next to the compose file.

If you omit `--out`, the wizard prints the full file to stdout for copy/paste (careful: includes secrets in your shell history or CI logs).

Local development (repo clone):

```bash
bun run env:wizard
bun run env:wizard:compile   # optional: writes dist/env-wizard
```

## SMTP (optional TLS and auth)

The PHP mailer (`CertificateMailer`) uses **`SMTP_HOST`**, **`SMTP_PORT`**, and **`MAIL_FROM_ADDRESS`**. Optional variables:

| Variable | Meaning |
|----------|---------|
| **`SMTP_SECURE`** | Empty = plain SMTP. **`tls`** = STARTTLS (typical port **587**). **`ssl`** = implicit TLS / SMTPS (typical port **465**). |
| **`SMTP_USER`** / **`SMTP_PASSWORD`** | Set **both** for authenticated SMTP, or leave **both** empty. |

## SQLite database (persistence)

The API stores data in SQLite. By default the file is **`/var/www/html/db/certs.sqlite`** inside the container (created on first request). Override with **`API_SQLITE_PATH`** (e.g. `/data/certs.sqlite`) in `.env` if you use a volume.

**Do not mount an empty host directory over `/var/www/html/db`** unless you also provide **`schema.sql`** in that mount — the app reads **`/var/www/html/db/schema.sql`** from the image to initialize the DB. A typical mistake is `-v ./db:/var/www/html/db` with an empty `./db`, which hides `schema.sql` and causes *Schema file not readable*. Prefer:

- set **`API_SQLITE_PATH=/data/certs.sqlite`** and mount **`/data`** (or a named volume for that path), or  
- avoid replacing the entire **`db`** directory with an empty bind mount.

### Reset the SQLite database

Data lives in **`/var/www/html/db/certs.sqlite`** by default or in **`API_SQLITE_PATH`** if set. **`Bootstrap`** reapplies **`db/schema.sql`** on every bootstrap, so wiping the DB file gives a fresh empty schema on next request.

Recommended (avoids SQLITE locks while nginx/php-fpm keeps the handle open):

1. **Stop** the stack: `docker compose -f … down` (or `stop` just the service).
2. Remove the SQLite file (`rm` on the host path backing the volume, or delete the bind-mounted file).
3. **Start** again; the app recreates **`certs.sqlite`** on first **`/api/health`** or API traffic.

Never delete **`schema.sql`** in the image; only remove **`*.sqlite`**.

If you insist on restarting without stopping, risk of wedged DB grows; **`docker compose restart`** after delete is safer.

## Compose: direct port (no reverse proxy)

For a single host port without Traefik:

1. Copy `docker-compose.direct.yml`, `README.md`, and `.env.example` from the release assets.
2. Generate or edit `.env` (see above). Set `REGISTRY_IMAGE`, `IMAGE_TAG`, `HOST_PORT`, and all API/SMTP variables.
3. Start:

```bash
docker compose -f docker-compose.direct.yml --env-file .env up -d
```

## Compose: behind Traefik

1. Ensure Traefik is running and using an **external** Docker network (e.g. `traefik`).
2. Copy `docker-compose.traefik.yml`, `README.md`, and `.env.example`.
3. Edit `.env` — set `REGISTRY_IMAGE`, `IMAGE_TAG`, `DOMAIN`, and `TRAEFIK_*` to match your Traefik static config.
4. Start:

```bash
docker compose -f docker-compose.traefik.yml --env-file .env up -d
```

If `env-wizard` fails to start inside an older fork of the image with missing dynamic libraries, ensure the runtime layer installs Alpine **`libstdc++`** (see `docker/production/Dockerfile`).

## GitHub configuration

- **No extra secrets** are required for CI to push: the default `GITHUB_TOKEN` with `packages: write` is enough.
- To allow **anonymous** `docker pull`, set the GHCR package visibility to **public** in the GitHub UI.

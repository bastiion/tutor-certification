# Production deploy (Docker + Traefik)

The release workflow builds a **single image** (nginx + PHP-FPM, port **8080**) and pushes it to **GitHub Container Registry**. Each GitHub Release attaches this folder so you can copy it to a host without cloning the repo.

## Pull and run (smoke test)

Default image namespace matches this repository; override only if you fork or republish.

```bash
docker pull ghcr.io/bastiion/tutor-certification:v0.1.0
docker run --rm -p 8080:8080 ghcr.io/bastiion/tutor-certification:v0.1.0
```

Open `http://localhost:8080/` (API JSON), `/tutor/`, `/enroll/`, `/verify/`.

Dev-only paths are **not** served in production (`/info.php`, `/dev/`, `/coverage/` → `404`).

## Traefik (recommended)

1. Ensure Traefik is running and using an **external** Docker network (e.g. `traefik`).
2. On the host, copy `docker-compose.traefik.yml`, `README.md`, and `.env.example` from the release assets.
3. `cp .env.example .env` and set `REGISTRY_IMAGE`, `IMAGE_TAG`, `DOMAIN`, and `TRAEFIK_*` to match your Traefik static config.
4. Start:

```bash
docker compose -f docker-compose.traefik.yml --env-file .env up -d
```

## GitHub configuration

- **No extra secrets** are required for CI to push: the default `GITHUB_TOKEN` with `packages: write` is enough.
- To allow **anonymous** `docker pull`, set the GHCR package visibility to **public** in the GitHub UI.

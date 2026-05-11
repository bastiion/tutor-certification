# 2026-05-11 — Production Docker image + GHCR release

## Scope

Single **production** runtime image (nginx + PHP-FPM on **port 8080**) built from [`docker/production/Dockerfile`](../../docker/production/Dockerfile): Bun builds static SPAs into `api/public/static-spa/`, Composer **`--no-dev`** vendor, nginx blocks dev-only routes (`/dev/`, `/info.php`, `/coverage/` → `404`).

## Delivered

- [`docker/production/`](../../docker/production/) — `Dockerfile`, `nginx.conf`, `php-production.ini`, `entrypoint.sh`.
- [`deploy/`](../../deploy/) — Traefik-oriented `docker-compose.traefik.yml`, `.env.example`, operator `README.md`.
- [`.github/workflows/release.yml`](../../.github/workflows/release.yml) — tag `v*.*.*`: build → smoke → push **GHCR** → GitHub Release with deploy assets.
- [`.github/dependabot.yml`](../../.github/dependabot.yml) — Docker updates for `docker/production` (in addition to `docker/php`).
- [`README.md`](../../README.md), [`CI.md`](../../CI.md) — release / operator pointers.

## Verification (local)

```bash
docker build -f docker/production/Dockerfile -t ikwsd-certs:prod .
docker run --rm -p 8080:8080 ikwsd-certs:prod
curl -fsS http://127.0.0.1:8080/ \
  | python3 -c 'import json,sys; print(json.load(sys.stdin).get("ok"))'
```

Canonical operator runbook: **[`deploy/README.md`](../../deploy/README.md)**.

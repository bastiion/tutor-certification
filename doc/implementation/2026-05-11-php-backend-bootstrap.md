# 2026-05-11 — PHP backend bootstrap

Delivered scaffolding only (no certificate API yet).

## What shipped

- [`api/`](/api/) Composer project: Pest, PHPStan strict on `src` + `tests`, PCOV, PHPMailer (dev helper for SMTP tests).
- [`api/src/Bootstrap/BootstrapProbe.php`](/api/src/Bootstrap/BootstrapProbe.php) temporary probe class plus unit tests aiming for **100 % coverage of `src/`**.
- Docker: custom [`docker/php/Dockerfile`](/docker/php/Dockerfile) (php-fpm 8.4, `pdo_sqlite`, PCOV), [`docker/nginx/api-default.conf`](/docker/nginx/api-default.conf), [`docker-compose.yml`](/docker-compose.yml) with Mailpit SMTP `1025` and API/UI `8025`.
- Bun scripts + Nix flake inputs: Docker/PHP tooling on PATH; [`package.json`](/package.json) wrappers for `composer`, Pest, PHPStan inside Compose.
- Mailpit bootstrap test clears inbox, sends via SMTP, asserts via REST API ([`api/tests/Integration/MailpitTest.php`](/api/tests/Integration/MailpitTest.php)); skipped locally unless `MAILPIT_INTEGRATION=1` (Compose enables it).

## Verification

Inside repo with Docker:

```bash
nix develop -c bun run composer:backend
nix develop -c bun run test:backend:coverage
nix develop -c bun run analyse:backend
```

## Legacy

The older static demo [`docker/www/`](/docker/www/) (sample PHP info page) is no longer wired into Compose; Compose now mounts [`api/`](/api/) for nginx/php-fpm.

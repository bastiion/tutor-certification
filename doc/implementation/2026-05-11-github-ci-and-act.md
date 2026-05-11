# 2026-05-11 — GitHub Actions CI, CodeQL, Dependabot, act

Canonical long-form doc: **[CI.md](../../CI.md)** (this file is the dated implementation stub).

## Delivered

- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): actionlint, Bun workspaces (typecheck + builds + `build:compose` artifact), Dockerized Pest coverage with JUnit/Clover/HTML uploads, Compose smoke + Cypress against `localhost:7123`, `bun audit` + `composer audit` + Trivy (non-failing exit), rollup job with step summary enforcement.
- [`.github/workflows/codeql.yml`](../.github/workflows/codeql.yml): CodeQL **JavaScript** analysis (includes TypeScript in the CodeQL model).
- [`.github/dependabot.yml`](../.github/dependabot.yml): weekly updates for GitHub Actions, npm (`bun.lock` at repo root), Composer (`api/`), Docker (`docker/php`, `docker/production`).
- [`.github/workflows/release.yml`](../.github/workflows/release.yml): tag-driven GHCR publish + GitHub Release (see [CI.md](../../CI.md), [production release note](2026-05-11-production-docker-release.md)).
- [`flake.nix`](../flake.nix): **`act`** and **`actionlint`** in the default dev shell.
- [`package.json`](../package.json): `ci:local`, `ci:act:list`, `ci:act`.
- [`README.md`](../README.md): CI / `act` rehearsal section.

## Verification hints

```bash
nix flake check
docker run --rm -v "$PWD:/repo" -w /repo docker.io/rhysd/actionlint:1.7.7
nix develop -c bun run ci:local
nix develop -c bun run ci:act:list
```

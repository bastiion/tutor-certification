# Glossary — PHP side of this repo

Plain-language meanings for files and commands under [`api/`](../api/). You write PHP code here; Composer and PHPUnit-family tools wire it together.

---

## Composer

PHP’s dependency and project orchestration tool—similar idea to **`package.json` + npm** in JavaScript land.

- **`composer.json`** defines which PHP packages your app needs and holds script shortcuts (like `composer test`).
- **`composer.lock`** freezes exact versions so everyone (and CI) installs the same tree. Commit it for applications.
- **`vendor/`** is the downloaded packages directory (ignored by Git).

Common commands:

```bash
composer install       # install from lockfile
composer update        # refresh lockfile (use when you intend to bump deps)
```

---

## Pest

A **test runner** for PHP with a short, readable syntax. It sits on top of **PHPUnit** (the long-established standard), so you get modern ergonomics without losing compatibility.

- Tests live under [`api/tests/`](../api/tests/) (e.g. `Unit/`, `Integration/`).
- Run with `composer test` or `pest` from `api/` when `vendor/bin` is on your PATH.

---

## `phpunit.xml`

Configuration for **PHPUnit** (and thus Pest). It tells the runner:

- where tests live,
- how to find **source code for coverage** (here: `api/src/`),
- where to put cache files.

You rarely edit it day to day; when you add new test layouts or change coverage scope, this file is the central place.

---

## `phpstan.neon`

Config for **PHPStan**, a **static analyzer**: it reads your PHP without running it and reports type mistakes, impossible branches, and similar issues. “Stricter” levels catch more; this project uses a high level on purpose.

- Run via `composer analyse` (see [`api/composer.json`](../api/composer.json)).

---

## `pest.php`

**Bootstrap file** for Pest: runs before your tests. Use it for global test setup (shared helpers, custom expectations). This project keeps it minimal.

---

## `public/index.php`

The **web entrypoint** nginx/Apache hit first. In our bootstrap it loads Composer’s autoloader and returns a small JSON response. Later it will delegate to a real router (e.g. Slim).

---

## Autoload / PSR-4

Composer maps **namespaces** to folders (see `autoload.psr4` in `composer.json`). Example: namespace `App\` → [`api/src/`](../api/src/). Renaming namespaces or folders must stay in sync with that mapping.

---

## PCOV (and coverage)

**PCOV** is a PHP extension that records **which lines ran** during tests. Pest/PHPUnit turns that into:

- HTML report (browse in a browser),
- **Clover XML** (for CI dashboards like Codecov).

Coverage is tuned in PHPUnit/Pest setup and optionally in `php.ini` (see our Docker PHP image).

---

## Mailpit (in this stack)

Not PHP-specific but used in **`api`** tests:

- **`Mailpit`** is a fake mail server that **accepts SMTP** like real mail and exposes a **web UI + HTTP API**.
- Integration tests send mail to Mailpit and then **query the API** to assert subject/body.

---

## Dockerfile / `docker-compose.yml` (PHP angle)

They build and run PHP **with extensions** (e.g. `pdo_sqlite`, `pcov`) and put **nginx in front**. Your **`api`** folder is mounted in, so editing PHP files does not require rebuilding the image unless you change system packages or the Dockerfile itself.

#
# Production image: Bun-built static SPAs, Composer `--no-dev` vendor, nginx + php-fpm in one container.
# Build context: repository root (--file docker/production/Dockerfile).
#

# ── Frontend (Bun workspaces) ─────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS frontend

ARG APP_VERSION=dev

WORKDIR /app

# Cache-friendly install
COPY package.json bun.lock ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY build.ts server.ts tsconfig.json ./

RUN bun install --frozen-lockfile && APP_VERSION=${APP_VERSION} bun run build:compose

# CLI: production `.env` wizard (single static binary for `docker run ... env-wizard`)
RUN bun build apps/env-wizard/src/main.ts --compile --outfile /app/env-wizard-bin \
    && chmod +x /app/env-wizard-bin

# ── PHP vendor (Composer, prod only) ─────────────────────────────────────
FROM composer:2 AS vendor

WORKDIR /var/www/html

COPY api/composer.json api/composer.lock ./
COPY api/src ./src
COPY api/public/index.php ./public/index.php
COPY api/public/openapi.json ./public/openapi.json
COPY api/db/schema.sql ./db/schema.sql

RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts \
    --no-progress

# ── Runtime: nginx + PHP-FPM ─────────────────────────────────────────────
FROM php:8.4-fpm-alpine

RUN apk add --no-cache nginx bash wget \
    && apk add --no-cache libstdc++ \
    && apk add --no-cache --virtual .build-deps-pdo sqlite-dev linux-headers $PHPIZE_DEPS \
    && docker-php-ext-install pdo_sqlite \
    && apk del .build-deps-pdo \
    && apk add --no-cache sqlite-libs \
    && docker-php-source delete

COPY docker/production/php-production.ini /usr/local/etc/php/conf.d/zzz-production.ini
# Alpine nginx loads `conf.d/` at root context only; virtual hosts belong in `http.d/` (included inside `http`).
COPY docker/production/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/production/entrypoint.sh /usr/local/bin/entrypoint-production.sh

RUN chmod +x /usr/local/bin/entrypoint-production.sh

COPY --from=frontend /app/env-wizard-bin /usr/local/bin/env-wizard

WORKDIR /var/www/html

COPY --from=vendor --chown=www-data:www-data /var/www/html ./
COPY --from=frontend --chown=www-data:www-data /app/api/public/static-spa ./public/static-spa

ENTRYPOINT ["/usr/local/bin/entrypoint-production.sh"]

# Uses GET /api/health (loads full Slim stack); matches Stage 7 / deploy expectations.
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD wget -q --spider http://127.0.0.1:8080/api/health || exit 1

EXPOSE 8080

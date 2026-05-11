#
# Production image: Bun-built static SPAs, Composer `--no-dev` vendor, nginx + php-fpm in one container.
# Build context: repository root (--file docker/production/Dockerfile).
#

# ── Frontend (Bun workspaces) ─────────────────────────────────────────────
FROM oven/bun:1.3-alpine AS frontend

WORKDIR /app

# Cache-friendly install
COPY package.json bun.lock ./
COPY apps ./apps
COPY packages ./packages
COPY scripts ./scripts
COPY build.ts server.ts tsconfig.json ./

RUN bun install --frozen-lockfile && bun run build:compose

# ── PHP vendor (Composer, prod only) ─────────────────────────────────────
FROM composer:2 AS vendor

WORKDIR /var/www/html

COPY api/composer.json api/composer.lock ./
COPY api/src ./src
COPY api/public/index.php ./public/index.php

RUN composer install \
    --no-dev \
    --no-interaction \
    --prefer-dist \
    --optimize-autoloader \
    --no-scripts \
    --no-progress

# ── Runtime: nginx + PHP-FPM ─────────────────────────────────────────────
FROM php:8.4-fpm-alpine

RUN apk add --no-cache nginx bash \
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

WORKDIR /var/www/html

COPY --from=vendor --chown=www-data:www-data /var/www/html ./
COPY --from=frontend --chown=www-data:www-data /app/api/public/static-spa ./public/static-spa

ENTRYPOINT ["/usr/local/bin/entrypoint-production.sh"]

EXPOSE 8080

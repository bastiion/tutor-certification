FROM php:8.5-fpm-alpine AS base

RUN apk add --no-cache git zip unzip sqlite-dev libsodium libsodium-dev $PHPIZE_DEPS linux-headers bash \
    && apk add --no-cache --virtual .build-deps-pecl-pear autoconf gcc g++ make \
    && pecl install pcov \
    && docker-php-ext-enable pcov \
    && docker-php-ext-install pdo_sqlite \
    && apk del .build-deps-pecl-pear \
    && docker-php-source delete

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY docker/php/php-dev.ini /usr/local/etc/php/conf.d/zzz-dev.ini

WORKDIR /var/www/html

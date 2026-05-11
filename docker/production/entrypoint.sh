#!/usr/bin/env sh
set -eu

# PHP-FPM (foreground-safe mode in base image runs as workers; detach for nginx as front process)
/usr/local/sbin/php-fpm &
exec nginx -g 'daemon off;'

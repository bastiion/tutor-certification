<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

header('Content-Type: application/json; charset=utf-8');

$probe = new \App\Bootstrap\BootstrapProbe();

echo json_encode(
    [
        'ok' => true,
        'probe' => $probe->status(),
        'php' => PHP_VERSION,
    ],
    JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE,
);

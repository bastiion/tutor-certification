<?php

declare(strict_types=1);

use App\Http\SlimApplicationFactory;

require __DIR__ . '/../vendor/autoload.php';

$apiRoot = dirname(__DIR__);
$app = SlimApplicationFactory::fromApiRoot($apiRoot);
$app->run();

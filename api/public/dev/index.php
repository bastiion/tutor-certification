<?php

declare(strict_types=1);

$scheme = (! empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$httpHostRaw = $_SERVER['HTTP_HOST'] ?? 'localhost';
$httpHost = htmlspecialchars($httpHostRaw, ENT_QUOTES | ENT_HTML5, 'UTF-8');

$coverageUrl = $scheme . '://' . $httpHostRaw . '/coverage/';
$coverageHref = htmlspecialchars($coverageUrl, ENT_QUOTES | ENT_HTML5, 'UTF-8');

?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>IKWSD — developer hub</title>
    <style>
        :root { font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1a1a; }
        body { margin: 0 auto; max-width: 40rem; padding: 2rem 1rem; }
        h1 { font-size: 1.35rem; margin-top: 0; }
        p.lead { color: #444; }
        ul { padding-left: 1.25rem; }
        li { margin-bottom: 0.5rem; }
        a { color: #065f46; }
        .muted { font-size: 0.875rem; color: #555; margin-top: 2rem; }
        code { background: #f0f4f8; padding: 0.1em 0.35em; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>Developer hub</h1>
    <p class="lead">
        Served from nginx on <code><?= $httpHost ?></code> (typical Compose URL: <code>http://localhost:7123/</code>). Other tools run on separate ports below.
    </p>
    <h2>This host (Compose API)</h2>
    <ul>
        <li><a href="/">API bootstrap JSON</a> — <code>GET /</code></li>
        <li><a href="<?= $coverageHref ?>">PHPUnit / Pest HTML coverage report</a> — run <code>bun run test:backend:coverage</code> first; otherwise expect <code>404</code>.</li>
        <li><a href="/info.php"><code>phpinfo()</code></a> (dev diagnostics)</li>
    </ul>
    <h2>Other local services</h2>
    <ul>
        <li><a href="http://localhost:3000">Bun/React frontend dev server</a> — start with <code>nix develop -c bun dev</code>.</li>
        <li><a href="http://localhost:8025">Mailpit</a> — captured SMTP (Docker Compose).</li>
    </ul>
    <p class="muted">
        Legacy copy of this dashboard also lives under <code>docker/www/index.php</code> when that tree is wired to a separate web root.
    </p>
</body>
</html>

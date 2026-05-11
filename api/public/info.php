<?php

declare(strict_types=1);

// Development only — disable or gate before any production exposure.

if (isset($_GET['phpinfo']) && $_GET['phpinfo'] === '1') {
    phpinfo();
    exit;
}

$scheme = (! empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$httpHostRaw = $_SERVER['HTTP_HOST'] ?? 'localhost';
$httpHost = htmlspecialchars($httpHostRaw, ENT_QUOTES | ENT_HTML5, 'UTF-8');
$base = $scheme . '://' . $httpHostRaw;

?><!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>IKWSD — local dev info</title>
    <style>
        :root { font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1a1a; }
        body { margin: 0 auto; max-width: 52rem; padding: 2rem 1rem; }
        h1 { font-size: 1.35rem; margin-top: 0; }
        h2 { font-size: 1.05rem; margin-top: 1.5rem; }
        p.lead { color: #444; }
        ul { padding-left: 1.25rem; }
        li { margin-bottom: 0.5rem; }
        a { color: #065f46; }
        .muted { font-size: 0.875rem; color: #555; margin-top: 2rem; }
        code { background: #f0f4f8; padding: 0.1em 0.35em; border-radius: 4px; }
        table.app-grid { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.95rem; }
        table.app-grid th, table.app-grid td { text-align: left; padding: 0.5rem 0.65rem; border: 1px solid #d0d7de; vertical-align: top; }
        table.app-grid thead th { background: #f6f8fa; font-weight: 600; }
        @media (max-width: 36rem) {
            table.app-grid { display: block; overflow-x: auto; }
        }
        .app-grid .url-hint { display: block; font-size: 0.85rem; color: #555; margin-top: 0.25rem; }
        table.app-grid tbody th { background: #fafbfc; font-weight: 600; color: #24292f; }
    </style>
</head>
<body>
    <h1>Local dev info</h1>
    <p class="lead">
        You are on <code><?= $httpHost ?></code> (e.g. Docker Compose nginx on <code>http://localhost:7123/</code>).
        Pre-built SPAs come from <code>bun run build:compose</code> (<code>api/public/static-spa/</code>).
    </p>

    <h2>Frontend apps: dev vs static staging</h2>
    <p class="lead">
        <strong>Hot reload</strong> — Bun dev server (run <code>bun dev</code>, default port 3000).
        <strong>Static staging</strong> — same paths on this nginx host (Compose).
    </p>
    <table class="app-grid">
        <thead>
            <tr>
                <th scope="col">App</th>
                <th scope="col">Hot reload (<code>bun dev</code>)</th>
                <th scope="col">Static staging (this host)</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <th scope="row">Tutor</th>
                <td><a href="http://localhost:3000/tutor/">Open</a> <span class="url-hint"><code>http://localhost:3000/tutor/</code></span></td>
                <td><a href="/tutor/">Open</a> <span class="url-hint"><code><?= htmlspecialchars($base . '/tutor/', ENT_QUOTES | ENT_HTML5, 'UTF-8') ?></code></span></td>
            </tr>
            <tr>
                <th scope="row">Participant (enroll)</th>
                <td><a href="http://localhost:3000/enroll/">Open</a> <span class="url-hint"><code>http://localhost:3000/enroll/</code></span></td>
                <td><a href="/enroll/">Open</a> <span class="url-hint"><code><?= htmlspecialchars($base . '/enroll/', ENT_QUOTES | ENT_HTML5, 'UTF-8') ?></code></span></td>
            </tr>
            <tr>
                <th scope="row">Verify</th>
                <td><a href="http://localhost:3000/verify/">Open</a> <span class="url-hint"><code>http://localhost:3000/verify/</code></span></td>
                <td><a href="/verify/">Open</a> <span class="url-hint"><code><?= htmlspecialchars($base . '/verify/', ENT_QUOTES | ENT_HTML5, 'UTF-8') ?></code></span></td>
            </tr>
        </tbody>
    </table>

    <h2>More</h2>
    <ul>
        <li><a href="/dev/">Developer hub</a> (coverage, Mailpit links, …)</li>
        <li><a href="/">API bootstrap JSON</a> — <code>GET /</code></li>
        <li><a href="?phpinfo=1">Full <code>phpinfo()</code></a> (verbose)</li>
    </ul>

    <p class="muted">
        Tip: Cypress against Compose uses <code>CYPRESS_BASE_URL=http://localhost:7123</code>; against Bun use the default <code>http://localhost:3000</code>.
    </p>
</body>
</html>

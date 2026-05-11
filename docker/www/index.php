<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>IKWSD — developer hub (legacy www)</title>
    <style>
        :root { font-family: system-ui, sans-serif; line-height: 1.5; color: #1a1a1a; }
        body { margin: 0 auto; max-width: 40rem; padding: 2rem 1rem; }
        h1 { font-size: 1.35rem; margin-top: 0; }
        p.lead { color: #444; }
        .note { background: #fff8e6; border: 1px solid #e6d9a9; padding: 0.75rem 1rem; border-radius: 6px; margin: 1rem 0 1.5rem; }
        ul { padding-left: 1.25rem; }
        li { margin-bottom: 0.5rem; }
        a { color: #065f46; }
        dl { display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 1rem; margin-top: 1.5rem; }
        dt { font-weight: 600; color: #333; }
        dd { margin: 0; }
        code { background: #f0f4f8; padding: 0.1em 0.35em; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>Developer hub <span style="font-weight: normal; font-size: 0.9rem; color: #555;">(<code>docker/www</code>)</span></h1>
    <p class="lead">Quick links for local tooling. Canonical hub when using Compose: <a href="http://localhost:7123/dev/">http://localhost:7123/dev/</a></p>

    <div class="note">
        The default project <code>docker-compose.yml</code> mounts <code>api/</code>, not this folder <code>docker/www/</code>.
        Browse <strong><a href="http://localhost:7123/">localhost:7123</a></strong> for nginx + php-fpm, or spin up a standalone server here if needed.
    </div>

    <h2>Docker Compose API (recommended)</h2>
    <ul>
        <li><a href="http://localhost:7123/">API bootstrap JSON</a></li>
        <li><a href="http://localhost:7123/dev/">Developer hub</a> (coverage + shortcuts)</li>
        <li><a href="http://localhost:7123/coverage/">HTML test coverage report</a> — after <code>bun run test:backend:coverage</code></li>
        <li><a href="http://localhost:7123/info.php">Local dev info / navigation</a> (<code>phpinfo</code>: add <code>?phpinfo=1</code>)</li>
    </ul>

    <h2>Static SPAs on Compose (after <code>bun run build:compose</code>)</h2>
    <ul>
        <li><a href="http://localhost:7123/tutor/">Tutor</a></li>
        <li><a href="http://localhost:7123/enroll/">Participant</a></li>
        <li><a href="http://localhost:7123/verify/">Verify</a></li>
    </ul>

    <h2>This folder only</h2>
    <ul>
        <li><a href="info.php"><code>phpinfo()</code> from <code>docker/www</code></a> — use only if nginx document root points here.</li>
    </ul>

    <h2>Other services</h2>
    <ul>
        <li><a href="http://localhost:3000/tutor/">Bun/React frontend (tutor)</a> (<code>bun dev</code>; also <code>/enroll/</code>, <code>/verify/</code>)</li>
        <li><a href="http://localhost:8025">Mailpit</a></li>
    </ul>

    <h2>PHP runtime (when this page is interpreted)</h2>
    <dl>
        <dt>PHP</dt>
        <dd><?= htmlspecialchars(PHP_VERSION, ENT_QUOTES, 'UTF-8') ?></dd>
        <dt>SAPI</dt>
        <dd><?= htmlspecialchars(PHP_SAPI, ENT_QUOTES, 'UTF-8') ?></dd>
        <dt>Time</dt>
        <dd><?= htmlspecialchars(date(DATE_ATOM), ENT_QUOTES, 'UTF-8') ?></dd>
        <dt>Document root</dt>
        <dd><?= htmlspecialchars($_SERVER['DOCUMENT_ROOT'] ?? '(unknown)', ENT_QUOTES, 'UTF-8') ?></dd>
        <dt>HTTP host</dt>
        <dd><?= htmlspecialchars($_SERVER['HTTP_HOST'] ?? '(unknown)', ENT_QUOTES, 'UTF-8') ?></dd>
    </dl>
</body>
</html>

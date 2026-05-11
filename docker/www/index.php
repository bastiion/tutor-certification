<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>nginx + PHP — up</title>
    <style>
        :root { font-family: system-ui, sans-serif; line-height: 1.5; }
        body { margin: 2rem; max-width: 40rem; }
        h1 { font-size: 1.25rem; }
        dl { display: grid; grid-template-columns: auto 1fr; gap: 0.25rem 1rem; }
        dt { font-weight: 600; color: #333; }
        dd { margin: 0; }
        .ok { color: #0a7; }
    </style>
</head>
<body>
    <h1 class="ok">nginx + PHP — OK</h1>
    <p>This page confirms the Docker Compose stack (nginx → php-fpm) is running and PHP is executing.</p>
    <dl>
        <dt>PHP</dt>
        <dd><?= htmlspecialchars(PHP_VERSION, ENT_QUOTES, 'UTF-8') ?></dd>
        <dt>SAPI</dt>
        <dd><?= htmlspecialchars(PHP_SAPI, ENT_QUOTES, 'UTF-8') ?></dd>
        <dt>Time (server)</dt>
        <dd><?= htmlspecialchars(date(DATE_ATOM), ENT_QUOTES, 'UTF-8') ?></dd>
        <dt>Document root</dt>
        <dd><?= htmlspecialchars($_SERVER['DOCUMENT_ROOT'] ?? '', ENT_QUOTES, 'UTF-8') ?></dd>
        <dt>HTTP host</dt>
        <dd><?= htmlspecialchars($_SERVER['HTTP_HOST'] ?? '', ENT_QUOTES, 'UTF-8') ?></dd>
        <dt>Server software</dt>
        <dd><?= htmlspecialchars($_SERVER['SERVER_SOFTWARE'] ?? 'nginx', ENT_QUOTES, 'UTF-8') ?></dd>
    </dl>
</body>
</html>

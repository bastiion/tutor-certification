<?php

declare(strict_types=1);

namespace App\Db;

use PDO;
use PDOException;

/**
 * Ensures SQLite schema exists (idempotent).
 */
final class Bootstrap
{
    private const SCHEMA_RELATIVE = 'db/schema.sql';

    public function __construct(
        private readonly string $apiRoot,
    ) {}

    public function databasePath(): string
    {
        $override = getenv('IKWSD_SQLITE_PATH');
        if (is_string($override) && $override !== '') {
            return $override;
        }

        return $this->apiRoot . '/db/certs.sqlite';
    }

    /**
     * Opens PDO to file SQLite, creates parent directory and applies schema if needed.
     */
    public function createPdo(): PDO
    {
        $dbDir = $this->apiRoot . '/db';
        if (! is_dir($dbDir)) {
            if (! mkdir($dbDir, 0o775, true) && ! is_dir($dbDir)) {
                throw new \RuntimeException('Cannot create database directory: ' . $dbDir);
            }
        }

        $path = $this->databasePath();
        $dsn = 'sqlite:' . $path;

        try {
            $pdo = new PDO($dsn, options: [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        } catch (PDOException $e) {
            throw new \RuntimeException('SQLite connection failed: ' . $e->getMessage(), 0, $e);
        }

        $schemaFile = $this->apiRoot . '/' . self::SCHEMA_RELATIVE;
        if (! is_readable($schemaFile)) {
            throw new \RuntimeException('Schema file not readable: ' . $schemaFile);
        }

        $sql = file_get_contents($schemaFile);
        if ($sql === false || $sql === '') {
            throw new \RuntimeException('Schema file empty: ' . $schemaFile);
        }

        $pdo->exec($sql);

        return $pdo;
    }
}

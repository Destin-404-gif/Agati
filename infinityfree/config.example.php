<?php
/**
 * Agati — database configuration for InfinityFree (and for local testing).
 *
 * Copy this file to config.php and fill in the real values. config.php holds
 * credentials, so it is in .gitignore and must never be committed or left
 * publicly readable — the bundled .htaccess denies it as well.
 *
 * DB_DRIVER is the only switch that matters:
 *   'mysql'  production on InfinityFree (they offer MySQL only)
 *   'pgsql'  local development against PostgreSQL
 * The SQL is written to run on both; nothing else needs changing.
 */

declare(strict_types=1);

$root = __DIR__;

return [
    // 'mysql' or 'pgsql'. Defaults to mysql, which is what InfinityFree runs.
    'db_driver' => 'mysql',

    // InfinityFree: the host from the MySQL Databases panel, which looks like
    // sqlXXX.infinityfree.com — NOT localhost. Using localhost there is the
    // single most common reason the installer cannot connect.
    'db_host' => 'sqlXXX.infinityfree.com',
    'db_port' => 3306,

    // InfinityFree: the panel creates the database and the user itself; the
    // name is usually if0_<digits>_<something> and the user is if0_<digits>.
    'db_name' => 'if0_XXXXXXXX_agati',
    'db_user' => 'if0_XXXXXXXX',
    'db_password' => '',

    // MySQL only. utf8mb4 is what holds every character, including emoji and
    // the ampersand in "Chairs & Seating".
    'db_charset' => 'utf8mb4',

    // PostgreSQL only; ignored when db_driver is 'mysql'.
    'db_schema' => 'public',

    // Leave base_url empty to auto-detect (works on InfinityFree). Set it only
    // if the site lives in a subdirectory, e.g. '/agati'.
    'base_url' => '',

    // Uploads are relative so the site works from any folder under htdocs.
    'upload_dir' => $root . '/uploads',
    'upload_url' => '/uploads',
    'max_upload_bytes' => 3 * 1024 * 1024,

    'session_name' => 'agati_session',

    // The installer asks for this before it will create anything. Change it to
    // something long and random, then delete install.php once it has run.
    'install_key' => 'change-me-to-a-long-random-string',

    // Set true only while debugging the installer.
    'display_errors' => false,
];
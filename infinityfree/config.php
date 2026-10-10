<?php
declare(strict_types=1);

$root = __DIR__;

return [
    'db_driver' => 'mysql',
    'db_host' => 'sql213.infinityfree.com',
    'db_port' => 3306,
    'db_name' => 'if0_43072789_agati',
    'db_user' => 'if0_43072789',
    'db_password' => 'WoodWorks26',
    'db_charset' => 'utf8mb4',
    'db_schema' => 'public',
    'base_url' => '',
    'upload_dir' => $root . '/uploads',
    'upload_url' => '/uploads',
    'max_upload_bytes' => 3 * 1024 * 1024,
    'session_name' => 'agati_session',
    'install_key' => 'agati-kesug-com-setup-key-change-this',
    'display_errors' => false,
];

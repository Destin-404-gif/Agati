<?php

/**
 * Run tests/db-test.php against both drivers.
 *
 *   php tests/run.php
 *
 * Each driver needs its own credentials. They come from environment variables
 * rather than a checked-in file, so no password ever lives in the project:
 *
 *   MYSQL_TEST_HOST / _PORT / _NAME / _USER / _PASSWORD
 *   PGSQL_TEST_HOST / _PORT / _NAME / _USER / _PASSWORD
 *
 * A config.php is written to the system temp directory for the run and deleted
 * afterwards; includes/db.php finds it through AGATI_CONFIG_FILE. The two runs
 * are separate PHP processes, because the connection is cached per process.
 */

declare(strict_types=1);

$php = PHP_BINARY;
$test = __DIR__ . '/db-test.php';

/**
 * Settings for one driver, or null if the environment is incomplete.
 *
 * HOST, NAME and USER must be given. PORT and PASSWORD may legitimately be
 * empty — a local MySQL root often has no password — so they are only defaulted,
 * not required.
 */
function settings(string $prefix): ?array
{
    $defaults = ['port' => '', 'password' => ''];
    $required = ['HOST', 'NAME', 'USER'];

    $out = [];
    foreach (['HOST', 'PORT', 'NAME', 'USER', 'PASSWORD'] as $key) {
        $value = getenv($prefix . '_TEST_' . $key);
        if ($value === false) {
            $value = $defaults[strtolower($key)] ?? '';
        }
        if ($value === '' && in_array($key, $required, true)) {
            return null;
        }
        $out[strtolower($key)] = $value;
    }
    return $out;
}

function runDriver(string $driver, array $settings): int
{
    $config = "<?php\nreturn " . var_export([
        'db_driver'   => $driver,
        'db_host'     => $settings['host'],
        'db_port'     => $settings['port'],
        'db_name'     => $settings['name'],
        'db_user'     => $settings['user'],
        'db_password' => $settings['password'],
        'db_charset'  => 'utf8mb4',
    ], true) . ";\n";

    $file = sys_get_temp_dir() . '/agati-test-' . $driver . '-' . getmypid() . '.php';
    file_put_contents($file, $config);

    // db.php caches the connection per process, so each driver needs its own run.
    $command = escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg(__DIR__ . '/db-test.php');

    putenv('AGATI_CONFIG_FILE=' . $file);
    passthru($command, $code);
    putenv('AGATI_CONFIG_FILE');
    unlink($file);

    return $code;
}

$targets = [
    'mysql' => settings('MYSQL'),
    'pgsql' => settings('PGSQL'),
];

$missing = [];
foreach ($targets as $name => $values) {
    if ($values === null) {
        $missing[] = strtoupper($name) . '_TEST_HOST/_PORT/_NAME/_USER/_PASSWORD';
    }
}
if ($missing !== []) {
    fwrite(STDERR, "\nMissing environment variables: " . implode(', ', $missing) . "\n");
    fwrite(STDERR, "Run tests/run.php from a shell that sets them, e.g.\n\n");
    fwrite(STDERR, "  \$env:MYSQL_TEST_NAME='agati_mysql'\n");
    fwrite(STDERR, "  php tests/run.php\n\n");
    exit(2);
}

$failed = [];
foreach ($targets as $name => $values) {
    if (runDriver($name, $values) !== 0) {
        $failed[] = $name;
    }
}

echo "\n";
if ($failed !== []) {
    echo "FAILED on: " . implode(', ', $failed) . "\n\n";
    exit(1);
}
echo "Both drivers passed.\n\n";
exit(0);
<?php
/**
 * One PDO connection for the whole site, built from config.php.
 *
 * There is deliberately no second way in: every query in this app goes through
 * db(), so switching DB_DRIVER in config.php is the only edit needed to run the
 * site on MySQL or PostgreSQL.
 *
 * The portability rules live here rather than in the page code:
 *   - driver()             which driver we are on
 *   - dsn()                the connection string for that driver
 *   - dbInsert()           new id, via lastInsertId() or RETURNING
 *   - dbUpsert()           ON DUPLICATE KEY UPDATE / ON CONFLICT DO UPDATE
 *   - groupConcat()        GROUP_CONCAT / STRING_AGG
 *   - placeholders()       positional bind markers, identical on both drivers
 *   - inClause()           returns [fragment, params]; binds on MySQL,
 *                          casts ints inline on PostgreSQL, because it cannot
 *                          bind an array
 *   - quoteIdent()         backticks vs double quotes
 *   - boolToDb()/dbToBool() booleans vs TINYINT(1)
 *   - limitOffset()        LIMIT/OFFSET, which both accept identically
 *
 * Only plain PDO + SQL is used: no Composer, no ORM, so it runs on shared
 * hosting that has no shell and no package manager.
 */

declare(strict_types=1);

/**
 * The loaded configuration, as an array.
 *
 * AGATI_CONFIG_FILE overrides where the file lives. It exists so the test
 * harness in tests/ can point at a throwaway config built from environment
 * variables: real credentials then never have to sit in the project tree at
 * all, which is what keeps config.php out of version control.
 */
function configFile(): string
{
    $override = getenv('AGATI_CONFIG_FILE');
    if (is_string($override) && $override !== '') {
        return $override;
    }
    return __DIR__ . '/../config.php';
}

/** @return array<string,mixed> */
function config(?string $key = null): mixed
{
    static $config = null;
    if ($config === null) {
        $file = configFile();
        if (!is_file($file)) {
            throw new RuntimeException(
                'config.php is missing. Copy config.example.php to config.php and fill it in.'
            );
        }
        $loaded = require $file;
        if (!is_array($loaded)) {
            throw new RuntimeException('config.php must return an array.');
        }
        $config = $loaded;
    }
    return $key === null ? $config : ($config[$key] ?? null);
}

/** 'mysql' or 'pgsql'. */
function driver(): string
{
    $driver = (string) config('db_driver', 'mysql');
    if (!in_array($driver, ['mysql', 'pgsql'], true)) {
        throw new RuntimeException("config.php: db_driver must be 'mysql' or 'pgsql', got '$driver'.");
    }
    return $driver;
}

function isMysql(): bool
{
    return driver() === 'mysql';
}

/** The DSN for the configured driver. */
function dsn(?string $dbName = null): string
{
    $host    = (string) config('db_host');
    $port    = (string) config('db_port');
    $name    = $dbName ?? (string) config('db_name');
    $charset = (string) config('db_charset', 'utf8mb4');

    if (isMysql()) {
        return "mysql:host=$host;port=$port;dbname=$name;charset=$charset";
    }
    // PostgreSQL takes the charset in the connection options, not the DSN.
    return "pgsql:host=$host;port=$port;dbname=$name";
}

/**
 * The shared connection.
 *
 * ERRMODE_EXCEPTION turns every database problem into a thrown PDOException, so
 * a failed query can never look like an empty result. Native prepares are used
 * where the driver supports them, which is both faster and what stops user input
 * being interpolated into a statement.
 */
function db(?string $dbName = null): PDO
{
    static $pdo = null;
    static $connectedTo = null;

    $target = $dbName ?? (string) config('db_name');
    if ($pdo !== null && $connectedTo === $target) {
        return $pdo;
    }

    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        // Real server-side prepares: values are sent separately from the SQL, so
        // a quote in a product name can never change the statement.
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::ATTR_STRINGIFY_FETCHES  => false,
    ];
    // The charset is already in the MySQL DSN; this repeats it as an init
    // command so it also applies on builds whose mysqlnd ignores the DSN
    // parameter. Driver-specific constants are checked with defined() because
    // they only exist when that PDO driver is loaded, and a shared host may
    // have a different build from the local one.
    if (isMysql() && defined('PDO::MYSQL_ATTR_INIT_COMMAND')) {
        $options[constant('PDO::MYSQL_ATTR_INIT_COMMAND')] =
            'SET NAMES ' . (string) config('db_charset', 'utf8mb4');
    }

    try {
        $pdo = new PDO(
            dsn($target),
            (string) config('db_user'),
            (string) config('db_password'),
            $options
        );
    } catch (PDOException $e) {
        // The message is passed on to install.php / a friendly error page, so keep
        // it intact but never echo credentials.
        throw new RuntimeException(
            'Could not connect to the database (' . driver() . '): ' . $e->getMessage(),
            0,
            $e
        );
    }

    // PostgreSQL has no charset in the DSN, so the encoding is set on the
    // session instead. Done as a statement rather than through
    // PDO::PGSQL_ATTR_CLIENT_ENCODING because that constant is absent on some
    // builds, and a missing constant is a fatal error rather than a fallback.
    if (!isMysql()) {
        $pdo->exec("SET client_encoding TO 'UTF8'");
    }

    $connectedTo = $target;
    return $pdo;
}

/** Run a prepared statement and return the PDOStatement. */
function dbQuery(string $sql, array $params = []): PDOStatement
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

/** All rows. */
function dbAll(string $sql, array $params = []): array
{
    return dbQuery($sql, $params)->fetchAll();
}

/** One row, or null. */
function dbOne(string $sql, array $params = []): ?array
{
    $row = dbQuery($sql, $params)->fetch();
    return $row === false ? null : $row;
}

/** A single scalar from the first column of the first row, or null. */
function dbValue(string $sql, array $params = []): mixed
{
    $value = dbQuery($sql, $params)->fetchColumn();
    return $value === false ? null : $value;
}

/**
 * Insert a row and return its new id, on either driver.
 *
 * PostgreSQL has no lastInsertId(): it appends "RETURNING id" and reads the
 * value off the statement. MySQL reads lastInsertId() instead. Both end up as
 * a plain int, so calling code never branches on the driver for this.
 *
 * $sequence is the name of the column to return, for the rare table whose
 * primary key is not called `id`.
 */
function dbInsert(string $sql, array $params = [], string $sequence = 'id'): int
{
    if (!isMysql()) {
        $sql = rtrim($sql, "; \t\n\r") . " RETURNING " . quoteIdent($sequence);
        $value = dbQuery($sql, $params)->fetchColumn();
        return (int) $value;
    }
    dbQuery($sql, $params);
    return (int) db()->lastInsertId();
}

/** Run INSERT/UPDATE/DELETE and report how many rows it touched. */
function dbExecute(string $sql, array $params = []): int
{
    return dbQuery($sql, $params)->rowCount();
}

/**
 * Insert, or update the existing row when the key is already there.
 *
 * MySQL:      INSERT .. ON DUPLICATE KEY UPDATE
 * PostgreSQL: INSERT .. ON CONFLICT (<key>) DO UPDATE
 *
 * $update is the list of columns to overwrite, e.g. ['name', 'price'].
 */
function dbUpsert(string $table, array $insert, array $update, string $conflictKey): void
{
    $columns = array_keys($insert);
    $params = array_values($insert);

    $colSql = implode(', ', array_map(static fn($c) => quoteIdent($c), $columns));
    $phSql = implode(', ', array_map(static fn($c) => ':' . $c, $columns));

    if (isMysql()) {
        // No conflict target to name: MySQL uses whichever unique key matches.
        $set = [];
        foreach ($update as $col) {
            $set[] = quoteIdent($col) . ' = VALUES(' . quoteIdent($col) . ')';
        }
        $sql = "INSERT INTO $table ($colSql) VALUES ($phSql) ON DUPLICATE KEY UPDATE "
             . implode(', ', $set);
    } else {
        $set = [];
        foreach ($update as $col) {
            $set[] = quoteIdent($col) . ' = EXCLUDED.' . quoteIdent($col);
        }
        $target = implode(', ', array_map(static fn($c) => quoteIdent($c), (array) $conflictKey));
        $sql = "INSERT INTO $table ($colSql) VALUES ($phSql) ON CONFLICT ($target) DO UPDATE SET "
             . implode(', ', $set);
    }

    dbQuery($sql, $params);
}

/**
 * Quote an identifier the way the current driver expects.
 *
 * MySQL wants backticks, PostgreSQL wants double quotes. Nothing in this app
 * needs quoting at all (every table and column name is plain lowercase), but the
 * helper exists so a future reserved word is never a syntax error on one driver.
 */
function quoteIdent(string $name): string
{
    if (isMysql()) {
        return '`' . str_replace('`', '``', $name) . '`';
    }
    return '"' . str_replace('"', '""', $name) . '"';
}

/** N positional placeholders: 3 -> '?, ?, ?'. */
function placeholders(int $count): string
{
    return implode(', ', array_fill(0, max(0, $count), '?'));
}

/**
 * Build an IN (...) condition that works on both drivers.
 *
 * Returns [sqlFragment, params]. Callers must splice both in, because which of
 * the two shapes is needed depends on the driver:
 *
 *     [$in, $inParams] = inClause($categoryIds, 'category_id');
 *     $rows = dbAll("SELECT * FROM products WHERE $in", $inParams);
 *
 * MySQL can bind a placeholder list, so the fragment is "IN (?, ?, ?)" and the
 * params are the ints. PostgreSQL cannot bind an array as a single parameter,
 * so the ints are inlined — safe because every value has been cast with
 * intval(), never quoted from user input.
 *
 * An empty list matches no rows on either driver: "IN ()" is a syntax error, so
 * FALSE is substituted instead.
 *
 * @return array{0:string,1:array}
 */
function inClause(array $ids, string $column = 'id'): array
{
    $ids = array_values(array_unique(array_map('intval', $ids)));
    $col = quoteIdent($column);

    if ($ids === []) {
        return ['1 = 0', []];
    }
    if (isMysql()) {
        return [$col . ' IN (' . placeholders(count($ids)) . ')', $ids];
    }
    return [$col . ' IN (' . implode(', ', $ids) . ')', []];
}

/**
 * Concatenate several TEXT/INT columns into one string.
 *
 * MySQL: GROUP_CONCAT(col SEPARATOR ', ')
 * PostgreSQL: STRING_AGG(col::text, ', ')
 *
 * The separator differs per driver, which is why this cannot be plain SQL.
 */
function groupConcat(string $column, string $separator = ', ', string $orderBy = ''): string
{
    $quoted = quoteIdent($column);
    if (isMysql()) {
        $order = $orderBy === '' ? '' : ' ORDER BY ' . $orderBy;
        return "GROUP_CONCAT($quoted$order SEPARATOR '$separator')";
    }
    $order = $orderBy === '' ? '' : ' ORDER BY ' . $orderBy;
    return "STRING_AGG($quoted::text, '$separator'$order)";
}

/** A boolean as the current driver stores it. */
function boolToDb(bool $value): int
{
    return $value ? 1 : 0;
}

/** Read a boolean back out of either representation. */
function dbToBool(mixed $value): bool
{
    if (is_bool($value)) {
        return $value;
    }
    return (int) $value === 1 || $value === '1' || $value === 't' || $value === 'true';
}

/**
 * LIMIT/OFFSET. Both drivers take the same spelling, so this only exists to keep
 * a literal out of page code and to refuse a negative offset early.
 */
function limitOffset(int $limit, int $offset = 0): string
{
    $limit = max(0, $limit);
    $offset = max(0, $offset);
    return "LIMIT $limit OFFSET $offset";
}

/** COALESCE on both drivers; IFNULL is MySQL-only and is deliberately not used. */
function coalesce(string ...$expressions): string
{
    return 'COALESCE(' . implode(', ', $expressions) . ')';
}

/** Run a whole .sql file, statement by statement. Used by install.php. */
function runSqlFile(string $path): int
{
    if (!is_file($path)) {
        throw new RuntimeException("SQL file not found: $path");
    }
    $sql = (string) file_get_contents($path);
    $pdo = db();
    $count = 0;

    foreach (splitSqlStatements($sql) as $statement) {
        if (trim($statement) === '') {
            continue;
        }
        $pdo->exec($statement);
        $count++;
    }
    return $count;
}

/**
 * Split a .sql file into individual statements.
 *
 * A naive explode(';') breaks three real cases, all of which appear in the
 * schema files, so the splitter understands each of them:
 *
 *   1. A semicolon inside a quoted string, a quoted identifier or a comment.
 *      Single quotes ('' escapes), double quotes and backticks are all tracked.
 *   2. DELIMITER. The MySQL schema defines triggers with DELIMITER $$ ... $$
 *      because a trigger body contains semicolons that are not statement
 *      terminators. The delimiter is honoured until it is changed back.
 *   3. Dollar quoting. The PostgreSQL schema defines functions as $$ ... $$ (or
 *      $tag$ ... $tag$), whose bodies contain semicolons too.
 */
function splitSqlStatements(string $sql): array
{
    $statements = [];
    $current = '';
    $length = strlen($sql);
    $delimiter = ';';

    $inSingle = $inDouble = $inBacktick = false;
    $inLineComment = $inBlockComment = false;
    $dollarTag = null; // non-null while inside a $tag$ ... $tag$ body

    for ($i = 0; $i < $length; $i++) {
        $ch = $sql[$i];
        $next = $i + 1 < $length ? $sql[$i + 1] : '';

        // Inside a dollar-quoted body nothing is special: we are only looking
        // for the closing tag, so no comments, strings or nesting apply.
        if ($dollarTag !== null) {
            $current .= $ch;
            if ($ch === '$' && substr($sql, $i, strlen($dollarTag)) === $dollarTag) {
                $current .= substr($sql, $i + 1, strlen($dollarTag) - 1);
                $i += strlen($dollarTag) - 1;
                $dollarTag = null;
            }
            continue;
        }

        if ($inLineComment) {
            if ($ch === "\n") {
                $inLineComment = false;
                $current .= $ch;
            }
            continue;
        }

        if ($inBlockComment) {
            if ($ch === '*' && $next === '/') {
                $inBlockComment = false;
                $i++;
            }
            continue;
        }

        if ($inSingle) {
            $current .= $ch;
            if ($ch === '\\' && $next !== '') {          // backslash escape
                $current .= $next;
                $i++;
            } elseif ($ch === "'" && $next === "'") {   // '' inside a string
                $current .= $next;
                $i++;
            } elseif ($ch === "'") {
                $inSingle = false;
            }
            continue;
        }

        if ($inDouble) {
            $current .= $ch;
            if ($ch === '\\' && $next !== '') {
                $current .= $next;
                $i++;
            } elseif ($ch === '"' && $next === '"') {
                $current .= $next;
                $i++;
            } elseif ($ch === '"') {
                $inDouble = false;
            }
            continue;
        }

        if ($inBacktick) {
            $current .= $ch;
            if ($ch === '`') {
                $inBacktick = false;
            }
            continue;
        }

        // Not inside anything. Only line starts matter for these three.
        if ($ch === '-' && $next === '-') {
            $inLineComment = true;
            $current .= '  ';
            $i++;
            continue;
        }
        if ($ch === '#') {
            $inLineComment = true;
            continue;
        }
        if ($ch === '/' && $next === '*') {
            $inBlockComment = true;
            $i++;
            continue;
        }

        // DELIMITER is a client-side directive, not SQL: switch the terminator
        // and emit nothing. Recognised at the start of a line so a string
        // containing the word is not mistaken for one.
        if (($ch === 'D' || $ch === 'd') && atLineStart($current)
            && preg_match('/^delimiter\s+(\S+)/i', $sql, $m, 0, $i)) {
            $delimiter = $m[1];
            $i += strlen($m[0]) - 1;
            $current = '';
            continue;
        }

        // The active delimiter, tested before anything that starts with $ or a
        // quote, because after `DELIMITER $$` the closing $$ of the body IS the
        // terminator. Checking the dollar-quote rule first would read that $$
        // as the opening of a new body and swallow the rest of the file.
        // With the default `;` delimiter this check cannot match a $, so the
        // dollar-quote rule below still works normally.
        if (substr($sql, $i, strlen($delimiter)) === $delimiter) {
            $statements[] = $current;
            $current = '';
            $i += strlen($delimiter) - 1;
            continue;
        }

        // A dollar-quoted body: $$, $body$ ... $body$.
        if ($ch === '$' && preg_match('/^\$([A-Za-z_][A-Za-z0-9_]*)?\$/', substr($sql, $i, 64), $m)) {
            $dollarTag = $m[0];
            $current .= $dollarTag;
            $i += strlen($dollarTag) - 1;
            continue;
        }

        if ($ch === "'") { $inSingle = true; $current .= $ch; continue; }
        if ($ch === '"') { $inDouble = true; $current .= $ch; continue; }
        if ($ch === '`') { $inBacktick = true; $current .= $ch; continue; }

        $current .= $ch;
    }

    if (trim($current) !== '') {
        $statements[] = $current;
    }
    return $statements;
}

/** True when only whitespace has been written on the current line so far. */
function atLineStart(string $buffered): bool
{
    $tail = strrchr($buffered, "\n");
    $line = $tail === false ? $buffered : substr($tail, 1);
    return trim($line) === '';
}

/** Every table in the schema, for install.php's report. */
function dbTables(): array
{
    if (isMysql()) {
        return array_column(dbAll('SHOW TABLES'), 'Tables_in_' . config('db_name'));
    }
    return array_column(
        dbAll(
            "SELECT tablename FROM pg_tables
              WHERE schemaname = 'public'
              ORDER BY tablename"
        ),
        'tablename'
    );
}

/** True when a table is present. */
function dbTableExists(string $table): bool
{
    return in_array($table, dbTables(), true);
}


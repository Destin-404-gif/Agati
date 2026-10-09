<?php

/**
 * Exercises includes/db.php against whichever driver the config selects.
 *
 * This is the test that backs the claim "switch one config value and the site
 * runs on either database". The same script is run twice — once with a MySQL
 * config, once with a PostgreSQL one — and every assertion has to pass on both.
 *
 *   php tests/db-test.php
 *
 * The database it runs against is a scratch one: the test creates and drops its
 * own rows and never touches real catalogue data.
 */

declare(strict_types=1);

require __DIR__ . '/../includes/db.php';

$passed = 0;
$failed = 0;

/** Assert and print in one line. */
function check(string $what, bool $ok, string $detail = ''): void
{
    global $passed, $failed;
    if ($ok) {
        $passed++;
        echo "  ok   $what\n";
    } else {
        $failed++;
        echo "  FAIL $what" . ($detail === '' ? '' : " — $detail") . "\n";
    }
}

function same(string $what, mixed $expected, mixed $actual): void
{
    check(
        $what,
        $expected === $actual,
        'expected ' . var_export($expected, true) . ', got ' . var_export($actual, true)
    );
}

echo "\n=== db layer on " . driver() . " ===\n";
echo 'host: ' . config('db_host') . '  database: ' . config('db_name') . "\n\n";

// ---------------------------------------------------------------- connection

echo "-- connection\n";
same('db() returns a PDO', true, db() instanceof PDO);
same('exception error mode is on', PDO::ERRMODE_EXCEPTION, db()->getAttribute(PDO::ATTR_ERRMODE));
same('associative fetch mode is the default', PDO::FETCH_ASSOC, db()->getAttribute(PDO::ATTR_DEFAULT_FETCH_MODE));

// A failed query must throw rather than return nothing, or a bug shows up as an
// empty page instead of an error.
$threw = false;
try {
    dbAll('SELECT * FROM a_table_that_does_not_exist');
} catch (PDOException $e) {
    $threw = true;
}
check('a bad query throws PDOException', $threw);

// --------------------------------------------------------------- scaffolding

// Rows the test owns, tagged so cleanup can find them again.
$run = 'agati_test_' . bin2hex(random_bytes(4));

dbExecute('DELETE FROM product_images WHERE product_id IN (SELECT id FROM products WHERE slug LIKE :run)',
    [':run' => $run . '%']);
dbExecute('DELETE FROM products WHERE slug LIKE :run', [':run' => $run . '%']);
dbExecute('DELETE FROM categories WHERE slug LIKE :run', [':run' => $run . '%']);

// ------------------------------------------------------------------ dbInsert

echo "\n-- dbInsert returns a usable new id on both drivers\n";
$productId = dbInsert(
    "INSERT INTO products (name, slug, sku, price, status, stock_quantity, is_new, is_featured, is_custom)
     VALUES (:name, :slug, :sku, :price, 'active', 5, :new, :feat, :custom)",
    [
        ':name'    => 'Test Chair ' . $run,
        ':slug'    => $run . '-chair',
        ':sku'     => strtoupper($run),
        ':price'   => 450000.00,
        ':new'     => boolToDb(true),
        ':feat'    => boolToDb(false),
        ':custom'  => boolToDb(false),
    ]
);
check('inserted id is a positive int', $productId > 0, 'got ' . var_export($productId, true));
same('the id really points at the new row', 1, (int) dbValue('SELECT COUNT(*) FROM products WHERE id = ?', [$productId]));

// A second insert must get a different id, which is where a naive
// lastInsertId() on PostgreSQL would return the wrong thing.
$secondId = dbInsert(
    "INSERT INTO products (name, slug, price, status) VALUES (:name, :slug, :price, 'active')",
    [':name' => 'Test Table ' . $run, ':slug' => $run . '-table', ':price' => 900000.00]
);
check('a second insert gets its own id', $secondId > $productId, "$secondId vs $productId");

// ----------------------------------------------------------------- booleans

echo "\n-- booleans round-trip\n";
$row = dbOne('SELECT is_new, is_featured, is_custom FROM products WHERE id = ?', [$productId]);
check('true reads back as true', dbToBool($row['is_new']));
check('false reads back as false', !dbToBool($row['is_featured']));
check('false reads back as false (2)', !dbToBool($row['is_custom']));
same('boolToDb(true)', 1, boolToDb(true));
same('boolToDb(false)', 0, boolToDb(false));

// ----------------------------------------------------------------- dbUpsert

echo "\n-- dbUpsert inserts then updates\n";
$slotKey = $run . '_slot';
dbUpsert('media_slots', ['slot_key' => $slotKey, 'label' => 'First label', 'position' => 1], ['label'], 'slot_key');
same('first call inserts', 'First label', dbValue('SELECT label FROM media_slots WHERE slot_key = ?', [$slotKey]));
dbUpsert('media_slots', ['slot_key' => $slotKey, 'label' => 'Second label', 'position' => 2], ['label'], 'slot_key');
same('second call updates in place', 'Second label', dbValue('SELECT label FROM media_slots WHERE slot_key = ?', [$slotKey]));
same('and does not duplicate the row', 1, (int) dbValue('SELECT COUNT(*) FROM media_slots WHERE slot_key = ?', [$slotKey]));

// ----------------------------------------------------------------- inClause

echo "\n-- inClause\n";
[$in, $inParams] = inClause([$productId, $secondId], 'id');
$found = dbAll("SELECT id FROM products WHERE $in ORDER BY id", $inParams);
same('two ids match two rows', 2, count($found));

// Non-integer junk must not leak into the SQL: inClause casts with intval, so
// this cannot become an injection point. "1 OR 1=1" becomes 1 and the empty
// string and null both become 0, so only the real id can match — and the
// result is scoped to this run's rows, because id 1 or 0 may exist on one
// driver and not the other.
[$inJunk, $junkParams] = inClause([$productId, '1 OR 1=1', '', null], 'id');
$foundJunk = dbAll(
    "SELECT id FROM products WHERE $inJunk AND slug LIKE ? ORDER BY id",
    array_merge($junkParams, [$run . '%'])
);
same('junk input is cast away, matching only this run\'s rows', 1, count($foundJunk));

// An empty list has to match nothing, and "IN ()" is a syntax error on both
// drivers, so this is the case most likely to break a page in production.
[$inEmpty, $emptyParams] = inClause([], 'id');
same('an empty list matches no rows', 0, count(dbAll("SELECT id FROM products WHERE $inEmpty", $emptyParams)));

// ---------------------------------------------------------------- groupConcat

echo "\n-- groupConcat\n";
$categoryId = dbInsert(
    'INSERT INTO categories (name, slug, sort_order, is_active) VALUES (:name, :slug, 99, :active)',
    [':name' => 'Test Category ' . $run, ':slug' => $run . '-category', ':active' => boolToDb(true)]
);
dbExecute('UPDATE products SET category_id = ? WHERE id IN (?, ?)', [$categoryId, $productId, $secondId]);
$concat = groupConcat('name', ', ', 'id');
$names = dbValue(
    "SELECT $concat FROM products WHERE category_id = ? GROUP BY category_id",
    [$categoryId]
);
check('both product names came back as one string', str_contains($names, $run), $names);
same('joined with the separator', 2, count(array_filter(explode(', ', $names), static fn($n) => trim($n) !== '')));

// --------------------------------------------------------------- limitOffset

echo "\n-- limitOffset\n";
$page1 = dbAll('SELECT id FROM products ORDER BY id ' . limitOffset(1, 0));
$page2 = dbAll('SELECT id FROM products ORDER BY id ' . limitOffset(1, 1));
same('first page has one row', 1, count($page1));
same('second page has one row', 1, count($page2));
check('the two pages are different rows', $page1[0]['id'] !== $page2[0]['id']);
same('a negative offset is clamped, not passed through', 'LIMIT 5 OFFSET 0', limitOffset(5, -10));

// ---------------------------------------------------------------- quoteIdent

echo "\n-- quoteIdent\n";
same('MySQL or PostgreSQL quoting', isMysql() ? '`x`' : '"x"', quoteIdent('x'));
// `key` is a reserved word in MySQL and needs backticks there; the schema files
// rely on this being safe to interpolate.
same('a reserved word is quoted', isMysql() ? '`key`' : '"key"', quoteIdent('key'));

// --------------------------------------------------------------- runSqlFile

echo "\n-- runSqlFile / splitSqlStatements\n";
// A string containing a semicolon must not be split.
$parts = splitSqlStatements("INSERT INTO a VALUES ('x;y'); SELECT 1;");
same('a semicolon inside a string does not split', 2, count($parts));
check('the string survived intact', str_contains($parts[0], "'x;y'"));

// A comment containing a semicolon must not split either.
$parts = splitSqlStatements("-- a comment; with a semicolon\nSELECT 1;\n/* block; comment */\nSELECT 2;");
same('comments do not split', 2, count($parts));

// DELIMITER blocks: the MySQL schema's triggers depend on this.
$parts = splitSqlStatements("DELIMITER $$\nCREATE TRIGGER t BEGIN SET a = 1; SET b = 2; END$$\nDELIMITER ;\nSELECT 1;");
same('a DELIMITER block is one statement', 2, count($parts));
check('the trigger body is whole', str_contains($parts[0], 'SET a = 1; SET b = 2;'));

// Dollar-quoted bodies: the PostgreSQL schema's functions depend on this.
$parts = splitSqlStatements("CREATE FUNCTION f() RETURNS trigger AS \$\$\nBEGIN\n  RETURN NEW;\nEND;\n\$\$ LANGUAGE plpgsql;\nSELECT 1;");
same('a dollar-quoted body is one statement', 2, count($parts));
check('the function body is whole', str_contains($parts[0], 'RETURN NEW;'));

// And the real thing: the file the installer actually runs.
$schemaFile = __DIR__ . '/../database/' . (isMysql() ? 'mysql' : 'pgsql') . '/schema.sql';
$statements = array_filter(
    splitSqlStatements((string) file_get_contents($schemaFile)),
    static fn($s) => trim($s) !== ''
);
check('the schema file splits into many statements', count($statements) > 30, count($statements) . ' statements');

// ------------------------------------------------------------------- cleanup

echo "\n-- cleanup\n";
dbExecute('DELETE FROM media_slots WHERE slot_key = ?', [$slotKey]);
dbExecute('DELETE FROM products WHERE id IN (?, ?)', [$productId, $secondId]);
same('products removed', 0, (int) dbValue('SELECT COUNT(*) FROM products WHERE slug LIKE ?', [$run . '%']));
dbExecute('DELETE FROM categories WHERE id = ?', [$categoryId]);
same('category removed', 0, (int) dbValue('SELECT COUNT(*) FROM categories WHERE id = ?', [$categoryId]));

// --------------------------------------------------------------- schema state

echo "\n-- schema is intact\n";
$tables = dbTables();
check('30 tables are present', count($tables) === 30, count($tables) . ' found');
foreach (['categories', 'nav_items', 'mega_menu_sections', 'menu_images', 'products', 'staff_users', 'roles'] as $t) {
    check("table $t exists", dbTableExists($t));
}

// The ten storefront categories, seeded identically on both drivers.
$cats = dbValue('SELECT COUNT(*) FROM categories WHERE slug NOT LIKE :run', [':run' => 'agati_test_%']);
same('ten seeded categories', 10, (int) $cats);
$navCats = dbValue("SELECT COUNT(*) FROM nav_items WHERE navbar = 'category_bar'");
same('ten seeded category-bar entries', 10, (int) $navCats);

// ------------------------------------------------------------- staff triggers

echo "\n-- staff trigger parity\n";
$email = $run . '@example.test';
dbExecute('DELETE FROM staff_users WHERE email = ?', [$email]);
dbInsert(
    "INSERT INTO staff_users (email, password_hash, role_id, status)
     VALUES (:email, 'x', 1, 'active')",
    [':email' => $email]
);
$staff = dbOne('SELECT username, status, is_active FROM staff_users WHERE email = ?', [$email]);
same('username is derived from the email', $run, $staff['username']);
check('is_active mirrors active', dbToBool($staff['is_active']));

dbExecute('UPDATE staff_users SET status = ? WHERE email = ?', ['suspended', $email]);
same('is_active follows status', false, dbToBool(
    dbValue('SELECT is_active FROM staff_users WHERE email = ?', [$email])
));

$rejected = false;
try {
    dbExecute('UPDATE staff_users SET status = ? WHERE email = ?', ['locked', $email]);
} catch (PDOException $e) {
    $rejected = true;
}
check('a status outside the allowed three is refused', $rejected);

// ------------------------------------------------------------------- summary

echo "\n=== $passed passed, $failed failed ===\n\n";
exit($failed === 0 ? 0 : 1);
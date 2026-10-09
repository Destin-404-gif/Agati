<?php

/**
 * Applies the real schema and seed files through runSqlFile(), which is the
 * exact code path install.php uses.
 *
 *   php tests/install-path.php
 *
 * This exists because the installer cannot be exercised by hand on a live
 * account: it drops and recreates every table. Here it runs against throwaway
 * databases named in the environment, so the splitter, the DELIMITER block in
 * the MySQL triggers and the dollar-quoted functions in the PostgreSQL schema
 * are all proven to survive being fed through PHP rather than a CLI client.
 *
 * MYSQL_TEST_NAME / PGSQL_TEST_NAME must point at disposable databases. The
 * script drops everything in them.
 */

declare(strict_types=1);

require __DIR__ . '/../includes/db.php';

$root = __DIR__ . '/..';
$ok = true;

echo "\n=== installer code path ===\n";
echo 'driver: ' . driver() . '  database: ' . config('db_name') . "\n\n";

$schemaFile = $root . '/database/' . (isMysql() ? 'mysql' : 'pgsql') . '/schema.sql';
$seedFile   = $root . '/database/' . (isMysql() ? 'mysql' : 'pgsql') . '/seed.sql';

$start = microtime(true);

try {
    $statements = runSqlFile($schemaFile);
    echo "schema: $statements statements applied\n";
} catch (Throwable $e) {
    echo "SCHEMA FAILED: " . $e->getMessage() . "\n";
    $ok = false;
}

if ($ok) {
    try {
        $statements = runSqlFile($seedFile);
        echo "seed:   $statements statements applied\n";
    } catch (Throwable $e) {
        echo "SEED FAILED: " . $e->getMessage() . "\n";
        $ok = false;
    }
}

if ($ok) {
    $tables = dbTables();
    echo 'tables: ' . count($tables) . "\n";

    $expected = [
        'categories', 'subcategories', 'menu_images', 'gallery_items', 'nav_items',
        'mega_menu_sections', 'products', 'product_placements', 'product_images',
        'product_variants', 'users', 'cart_items', 'orders', 'order_items',
        'quote_requests', 'quote_notes', 'roles', 'permissions', 'role_permissions',
        'staff_users', 'sessions', 'password_resets', 'login_attempts', 'audit_logs',
        'settings', 'media_slots', 'media_uploads', 'banners', 'pages', 'announcements',
    ];
    $missing = array_values(array_diff($expected, $tables));
    if ($missing !== []) {
        echo 'MISSING TABLES: ' . implode(', ', $missing) . "\n";
        $ok = false;
    }

    foreach ([
        ['categories', 10],
        ['nav_items', 13],
        ['mega_menu_sections', 25],
        ['permissions', 15],
        ['roles', 4],
        ['media_slots', 6],
    ] as [$table, $expectedCount]) {
        $actual = (int) dbValue("SELECT COUNT(*) FROM $table");
        $status = $actual === $expectedCount ? 'ok  ' : 'FAIL';
        if ($actual !== $expectedCount) {
            $ok = false;
        }
        echo "  $status $table: $actual rows (expected $expectedCount)\n";
    }

    // The installer creates the admin account itself; what matters here is that
    // the sequence is positioned so its first insert does not collide.
    $probe = dbInsert(
        "INSERT INTO categories (name, slug, sort_order, is_active) VALUES ('Probe','probe',999,?)",
        [boolToDb(true)]
    );
    $maxId = (int) dbValue('SELECT MAX(id) FROM categories WHERE slug <> ?', ['probe']);
    echo '  ' . ($probe === $maxId + 1 ? 'ok  ' : 'FAIL')
        . " next auto id is $probe, one past the seeded max of $maxId\n";
    if ($probe !== $maxId + 1) {
        $ok = false;
    }
    dbExecute('DELETE FROM categories WHERE slug = ?', ['probe']);

    // Every category-bar entry must find its category by slug: the storefront
    // joins on slug, not id, so a mismatch here is a silently empty mega menu.
    $orphans = dbAll(
        "SELECT n.slug AS nav_slug, c.slug AS cat_slug
           FROM nav_items n
           LEFT JOIN categories c ON c.slug = n.slug
          WHERE n.navbar = 'category_bar' AND c.slug IS NULL"
    );
    echo '  ' . (count($orphans) === 0 ? 'ok  ' : 'FAIL')
        . ' every category-bar entry matches a category by slug' . "\n";
    if ($orphans !== []) {
        $ok = false;
        foreach ($orphans as $o) {
            echo "        orphan: {$o['nav_slug']}\n";
        }
    }
}

printf("\ndone in %.2fs — %s\n\n", microtime(true) - $start, $ok ? 'PASS' : 'FAIL');
exit($ok ? 0 : 1);
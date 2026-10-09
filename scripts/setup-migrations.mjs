#!/usr/bin/env node
/**
 * Applies every file in db/migrations/ against DATABASE_URL, in name order.
 * Each migration is written to be idempotent, so re-running is harmless.
 */
import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const file of [".env.local", ".env"]) {
  const full = path.join(root, file);
  if (existsSync(full)) {
    process.loadEnvFile(full);
    console.log(`  loaded ${file}`);
    break;
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("\n  DATABASE_URL is not set. Copy .env.example to .env.local first.\n");
  process.exit(1);
}

const dir = path.join(root, "db", "migrations");
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

const client = new Client({
  connectionString: url,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  console.log(`\n  connected to ${new URL(url).host}\n`);

  for (const file of files) {
    const sql = await readFile(path.join(dir, file), "utf8");
    process.stdout.write(`  → ${file} ... `);
    await client.query(sql);
    console.log("done");
  }

  const { rows } = await client.query(`
    SELECT (SELECT COUNT(*)::int FROM orders)                AS orders,
           (SELECT COUNT(*)::int FROM orders
             WHERE order_number IS NOT NULL)                 AS numbered,
           (SELECT COUNT(*)::int FROM products WHERE is_custom) AS custom_products
  `);
  const r = rows[0];
  console.log(
    `\n  ${r.orders} orders (${r.numbered} numbered) · ${r.custom_products} made-to-measure products\n`,
  );
} catch (err) {
  console.error(`\n  FAILED: ${err.message}\n`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
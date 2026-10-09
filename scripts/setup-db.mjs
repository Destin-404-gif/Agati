#!/usr/bin/env node
/**
 * Applies db/schema.sql and db/seed.sql against DATABASE_URL.
 *
 *   npm run db:setup     schema + seed
 *   npm run db:schema    schema only (drops existing tables)
 *   npm run db:seed      seed only
 */
import { readFile } from "node:fs/promises";
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
  console.error("\nDATABASE_URL is not set. Copy .env.example to .env.local first.\n");
  process.exit(1);
}

const mode = process.argv[2] ?? "all";
const steps = mode === "schema" ? ["schema"] : mode === "seed" ? ["seed"] : ["schema", "seed"];

const client = new Client({
  connectionString: url,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  console.log(`\n  connected to ${new URL(url).host}\n`);

  for (const step of steps) {
    const file = path.join(root, "db", `${step}.sql`);
    const sql = await readFile(file, "utf8");
    process.stdout.write(`  → ${step}.sql ... `);
    await client.query(sql);
    console.log("done");
  }

  const { rows } = await client.query(`
    SELECT (SELECT COUNT(*)::int FROM categories) AS categories,
           (SELECT COUNT(*)::int FROM products)    AS products,
           (SELECT COUNT(*)::int FROM product_images) AS images,
           (SELECT COUNT(*)::int FROM product_variants) AS variants
  `);

  const r = rows[0];
  console.log(
    `\n  ${r.categories} categories · ${r.products} products · ${r.images} images · ${r.variants} variants\n`,
  );
} catch (err) {
  console.error(`\n  FAILED: ${err.message}\n`);
  if (err.code === "ECONNREFUSED") {
    console.error("  Is PostgreSQL running? Check the host/port in DATABASE_URL.\n");
  } else if (err.code === "3D000") {
    console.error("  Database does not exist. Create it, e.g.:\n");
    console.error("    psql -U postgres -c \"CREATE DATABASE agati\"\n");
  }
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

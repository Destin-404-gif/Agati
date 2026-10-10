#!/usr/bin/env node
/**
 * Idempotently make sure every registry slot has a `media_slots` row.
 *
 * A fresh database has no rows, so the admin "Media & Banners" page lists slots
 * that the API then rejects with "Unknown image slot". This inserts the missing
 * rows and never overwrites an image that is already assigned, so it is safe to
 * run on every deploy.
 *
 *   npm run db:sync-slots
 *
 * On Render, run this once from the service Shell after the first deploy (or add
 * it as a pre-deploy command). The admin Media page also syncs on each render, so
 * it self-heals even without this - the script is for CI/deploy pipelines.
 *
 * The slot list is imported from `src/lib/media-slots.ts` - the single source of
 * truth - rather than copied, so adding a slot there is enough.
 */
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { Client } from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const file of [".env.local", ".env"]) {
  const full = path.join(ROOT, file);
  if (existsSync(full)) {
    process.loadEnvFile(full);
    break;
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("\nDATABASE_URL is not set. Copy .env.example to .env.local first.\n");
  process.exit(1);
}

const client = new Client({
  connectionString: url,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  console.log(`  connected to ${client.database}`);

  // The registry is the single source of truth: no slot keys are copied here.
  const { MEDIA_SLOTS, categorySlotDef } = await import(
    pathToFileURL(path.join(ROOT, "src", "lib", "media-slots.ts")).href
  );

  const { rows: categories } = await client.query(
    `SELECT slug, name FROM categories ORDER BY name`,
  );

  const defs = [...MEDIA_SLOTS, ...categories.map((c) => categorySlotDef(c.slug, c.name))];

  const result = await client.query(
    `INSERT INTO media_slots (slot_key, label, group_name, kind, alt_text, position)
     SELECT * FROM UNNEST($1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $5::varchar[], $6::int[])
     ON CONFLICT (slot_key) DO NOTHING`,
    [
      defs.map((d) => d.key),
      defs.map((d) => d.label),
      defs.map((d) => d.group),
      defs.map((d) => d.kind),
      defs.map((d) => d.alt || null),
      defs.map((_d, i) => i),
    ],
  );

  const { rows: counts } = await client.query(
    `SELECT COUNT(*)::int AS total, COUNT(image_url)::int AS filled FROM media_slots`,
  );

  console.log(`  registry: ${defs.length} slots · created ${result.rowCount} new row(s)`);
  console.log(`  media_slots: ${counts[0].filled}/${counts[0].total} filled\n`);
} catch (err) {
  console.error(`\n  FAILED: ${err.message}\n`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

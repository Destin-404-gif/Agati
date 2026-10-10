#!/usr/bin/env node
/**
 * Report image records whose file can no longer be found.
 *
 * On an ephemeral host (Render) every picture uploaded before a redeploy is
 * gone even though its database row remains, so the storefront renders a broken
 * icon. This scans each table that stores an image url and lists the rows whose
 * file is missing, so they can be re-uploaded from the admin.
 *
 * Usage:
 *   npm run db:missing-images               # check local/public + remote (HEAD)
 *   npm run db:missing-images -- --no-remote  # skip network checks
 *   npm run db:missing-images -- --json      # machine-readable output
 *
 * Read-only: it never changes the database or deletes anything.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "pg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const checkRemote = !args.includes("--no-remote");
const asJson = args.includes("--json");

for (const file of [".env.local", ".env"]) {
  const full = path.join(root, file);
  if (existsSync(full)) {
    process.loadEnvFile(full);
    break;
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("\n  DATABASE_URL is not set. Copy .env.example to .env.local first.\n");
  process.exit(1);
}

/**
 * Every (table, id, url-column) worth checking. `label` is only used for the
 * human-readable report.
 */
const TARGETS = [
  { label: "Media library", table: "media_uploads", id: "id", columns: ["url", "thumb_url", "variant_400_url", "variant_1200_url", "variant_2560_url", "variant_3840_url"] },
  { label: "Media slots", table: "media_slots", id: "slot_key", columns: ["image_url", "thumb_url", "variant_400_url", "variant_1200_url", "variant_2560_url", "variant_3840_url"] },
  { label: "Categories", table: "categories", id: "id", columns: ["image_url"] },
  { label: "Subcategories", table: "subcategories", id: "id", columns: ["image_url"] },
  { label: "Menu images", table: "menu_images", id: "id", columns: ["image_path"] },
  { label: "Gallery", table: "gallery_items", id: "id", columns: ["image_url", "thumbnail_url", "variant_400_url", "variant_1200_url", "variant_2560_url", "variant_3840_url"] },
  { label: "Team", table: "team_members", id: "id", columns: ["photo_url"] },
  { label: "Banners", table: "banners", id: "id", columns: ["image_url"] },
  { label: "Product images", table: "product_images", id: "id", columns: ["image_url"] },
  { label: "Product variants", table: "product_variants", id: "id", columns: ["image_url"] },
].filter((t) => t.columns.length > 0);

/** Whether a stored value points at a file that still exists. */
async function checkUrl(value, cache) {
  if (!value) return null;

  if (cache.has(value)) return cache.get(value);

  let status;
  if (value.startsWith("/uploads/")) {
    // Legacy local upload: the whole point of this report.
    const name = path.basename(value);
    status = existsSync(path.join(root, "storage", "uploads", name)) ? "ok" : "missing";
  } else if (value.startsWith("/")) {
    // A bundled public asset (seed data), e.g. /images/foo.jpg.
    status = existsSync(path.join(root, "public", value.slice(1))) ? "ok" : "missing";
  } else if (/^https?:\/\//i.test(value)) {
    if (!checkRemote) {
      status = "unchecked";
    } else {
      try {
        const res = await fetch(value, { method: "HEAD", redirect: "follow" });
        status = res.ok || (res.status >= 300 && res.status < 400) ? "ok" : "missing";
      } catch {
        status = "unreachable";
      }
    }
  } else {
    status = "invalid";
  }

  cache.set(value, status);
  return status;
}

const client = new Client({
  connectionString: url,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});

const findings = [];
const cache = new Map();

try {
  await client.connect();
  if (!asJson) console.log(`\n  connected to ${new URL(url).host}`);
  if (!asJson) console.log("  checking image records (this can take a moment for remote urls)\n");

  for (const target of TARGETS) {
    const select = [target.id, ...target.columns].join(", ");
    let rows;
    try {
      ({ rows } = await client.query(`SELECT ${select} FROM ${target.table}`));
    } catch (err) {
      if (!asJson) console.log(`  ! ${target.label}: skipped (${err.message})`);
      continue;
    }

    for (const row of rows) {
      for (const column of target.columns) {
        const status = await checkUrl(row[column], cache);
        if (status && status !== "ok") {
          findings.push({
            area: target.label,
            table: target.table,
            id: row[target.id],
            column,
            url: row[column],
            status,
          });
        }
      }
    }
  }

  if (asJson) {
    console.log(JSON.stringify({ generatedAt: new Date().toISOString(), findings }, null, 2));
  } else if (findings.length === 0) {
    console.log("  All image records resolve to a file that exists.\n");
  } else {
    const byArea = new Map();
    for (const f of findings) {
      if (!byArea.has(f.area)) byArea.set(f.area, []);
      byArea.get(f.area).push(f);
    }
    console.log(`  ${findings.length} broken image reference(s) across ${byArea.size} area(s):\n`);
    for (const [area, items] of byArea) {
      console.log(`  ${area} (${items.length})`);
      for (const f of items) {
        console.log(`    - ${f.table}.${f.column} id=${f.id} [${f.status}] ${f.url}`);
      }
    }
    console.log(
      "\n  Re-upload the pictures above from Admin. Rows that point at remote\n" +
        "  (Cloudinary) urls marked missing were deleted from storage.\n",
    );
  }
} catch (err) {
  console.error(`\n  FAILED: ${err.message}\n`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

/**
 * Clears image references that point at the server's temporary filesystem.
 *
 * Render's disk is ephemeral, so any admin upload stored as `/uploads/...` is a
 * broken image after a redeploy. This script turns those values back to NULL so
 * the site renders its neutral placeholder instead of a dead <img> on every
 * visit. It never touches an https link - links are how an image survives.
 *
 * Rows are only changed when the current value actually starts with the local
 * upload prefix, so re-running is a no-op and nothing an admin chose (a Cloudinary
 * URL, a pasted link, a placeholder) is ever overwritten.
 *
 *   node scripts/fix-broken-images.mjs          # report only
 *   node scripts/fix-broken-images.mjs --apply  # clear the broken references
 */

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLY = process.argv.includes("--apply");

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
await client.connect();
console.log(`  connected to ${client.database}\n`);

// table -> columns whose value is an image URL / local file path that died with
// the filesystem. Alternate columns (thumbnail/variant families, dimensions,
// byte counts) ride along so a cleared row reads as "empty slot", not "half a
// broken image".
const TABLES = [
  { table: "media_slots", primary: "image_url", extras: ["thumb_url", "variant_400_url", "variant_1200_url", "variant_2560_url", "variant_3840_url", "width", "height", "bytes", "original_width", "original_height"] },
  { table: "gallery_items", primary: "image_url", extras: ["thumbnail_url", "variant_400_url", "variant_1200_url", "variant_2560_url", "variant_3840_url", "image_width", "image_height", "image_bytes", "original_width", "original_height"] },
  { table: "menu_images", primary: "image_path", extras: [] },
  { table: "categories", primary: "image_url", extras: ["image_alt"] },
  { table: "subcategories", primary: "image_url", extras: ["image_alt"] },
  { table: "products", primary: "image_url", extras: [] },
  { table: "product_variants", primary: "image_url", extras: [] },
  { table: "banners", primary: "image_url", extras: [] },
];

let cleared = 0;
let broken = 0;

/**
 * A value is "local and dead" when it is one of:
 *   - an /uploads/ or uploads/ path (the ephemeral store - gone after a
 *     redeploy), or
 *   - a bare filename like `d1c9e7f37b71a040a6f817cb10a00305.jpg` (no scheme,
 *     no leading slash, so it is not a link and not a bundled /images asset).
 *
 * Anything with a scheme (http/https/data:) or a leading slash into the static
 * bundle (/images/..., /svg/...) is left alone, and so is every Cloudinary URL.
 */
function candidateSql(column) {
  return `("${column}" ~* '^/?(uploads|storage)/' OR "${column}" ~* '^[^/?#]+[.](jpe?g|png|webp|gif|avif|svg)$')`;
}

for (const { table, primary, extras } of TABLES) {
  // A table might not exist on a fresh database that hasn't been migrated yet.
  const { rows: exists } = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  if (exists.length === 0) continue;

  const { rows: cols } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
    [table],
  );
  const present = new Set(cols.map((c) => c.column_name));
  if (!present.has(primary)) continue;

  const extrasSql = extras
    .filter((c) => present.has(c))
    .map((c) => `"${c}" = NULL`)
    .join(", ");

  const countRows = await client.query(
    `SELECT COUNT(*)::int AS n FROM "${table}" WHERE ${candidateSql(primary)}`,
  );
  const n = countRows.rows[0].n;
  if (n === 0) continue;
  broken += n;

  if (!APPLY) {
    console.log(`  ${table}: ${n} broken ${n === 1 ? "reference" : "references"} (${primary})`);
    continue;
  }

  const setPrimary = `"${primary}" = NULL`;
  const columns = [setPrimary, extrasSql].filter(Boolean).join(", ");
  const { rowCount } = await client.query(
    `UPDATE "${table}" SET ${columns} WHERE ${candidateSql(primary)}`,
  );
  cleared += rowCount;
  console.log(`  ${table}: cleared ${rowCount}`);
}

/* ---------------------------------- the media library's local files, too */

{
  const { rows: cols } = await client.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'media_uploads'`,
  );
  const has = (c) => cols.some((row) => row.column_name === c);
  if (has("url")) {
    const predicate = `("url" ~* '^/?(uploads|storage)/' OR "url" ~* '^[^/?#]+[.](jpe?g|png|webp|gif|avif|svg)$')`;
    const { rows: cnt } = await client.query(
      `SELECT COUNT(*)::int AS n FROM media_uploads WHERE ${predicate}`,
    );
    if (cnt[0].n > 0) {
      broken += cnt[0].n;
      if (APPLY) {
        const colsSql = ["url = NULL", ...(has("thumb_url") ? ["thumb_url = NULL"] : [])].join(", ");
        const { rowCount } = await client.query(
          `UPDATE media_uploads SET ${colsSql} WHERE ${predicate}`,
        );
        cleared += rowCount;
        console.log(`  media_uploads: cleared ${rowCount} unlinked library rows`);
      } else {
        console.log(`  media_uploads: ${cnt[0].n} broken references (url)`);
      }
    }
  }
}

console.log("");
if (APPLY) {
  console.log(`  Done. Cleared ${cleared} broken references.`);
} else {
  console.log(`  Found ${broken} broken ${broken === 1 ? "reference" : "references"} pointing at the local filesystem.`);
  console.log("  Re-run with --apply to clear them (broken images become placeholders).");
  console.log("  https links are never touched.");
}

await client.end();
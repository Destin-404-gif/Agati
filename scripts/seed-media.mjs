/**
 * Seeds `media_slots` from the photography that is already in `public/images`.
 *
 * The site used to reference these files as literals in `src/lib/images.ts`
 * (and, for the hero, inline in `Hero.tsx`). Those are now slot keys instead, so
 * without this the site would come up with placeholders everywhere on a fresh
 * database. This script points every slot at the photo it was already showing.
 *
 * It is deliberately non-destructive: an existing non-null `image_url` is never
 * overwritten, so re-running after an admin has swapped a picture is a no-op for
 * that slot. Use `--force` to reset every slot back to the original photo.
 *
 *   node scripts/seed-media.mjs            # fill empty slots only
 *   node scripts/seed-media.mjs --force    # reset all slots
 *
 * The slot list is imported from `src/lib/media-slots.ts` rather than copied, so
 * adding a slot to the registry is enough for it to appear here too.
 */

import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { Client } from "pg";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FORCE = process.argv.includes("--force");

/* --------------------------------------------------------- env + connect */

for (const file of [".env.local", ".env"]) {
  const full = path.join(ROOT, file);
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

const client = new Client({
  connectionString: url,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});
await client.connect();
console.log(`  connected to ${client.database}\n`);

/* ------------------------------------------------------------- the photos */

// The same pools `scripts/import-images.mjs` writes into `src/lib/images.ts`,
// kept in aspect-ratio order. Slot assignments below mirror the old literals
// one-for-one, so the storefront is pixel-identical after seeding.
const LOGO = "/images/agati-logo.png";

const LANDSCAPE = [
  "/images/fc066196685bd22013f39d81651b1d18.jpg",
  "/images/bbb2eba128d50379aa94fd88ad5b3b1f.jpg",
  "/images/ae12f2de1d2481fe87724738a74116ad.jpg",
  "/images/1b826d45429fc863155d96fdd0fe8206.jpg",
];

const SQUARE = [
  "/images/93bbd604a1708a8ec647e4e1477e5cd3.jpg",
  "/images/eb63c0585fc92c84b9604a77ad832af9.jpg",
  "/images/6a2dc6d06bce4f14876a911d43d49547.jpg",
  "/images/2d1a538abdbf505e629439ec1d153692.jpg",
  "/images/3b03e9b74e8626386865781b1ade6d05.jpg",
  "/images/026de8f36b5a48ee200640422215613e.jpg",
];

const PORTRAIT = [
  "/images/722c409355ea1b257fcffac9ad74c45f.jpg",
  "/images/722594337cd0404894960da95bac0c85.jpg",
  "/images/6810cafab629f718fa1b3fcbecc73894.jpg",
  "/images/32f5312120115c193648b5d87b0c2d5e.jpg",
  "/images/8bbe890a02dc3d74a06923a90119d470.jpg",
  "/images/a3275c39eebc7f96ff8e4d0068396c2e.jpg",
  "/images/58cec0fa0b8e9419b71ee79748d02435.jpg",
  "/images/ca52cd588e9675652905324b50a76cdc.jpg",
  "/images/4bd99f974839ce2291700c66e7e125de.jpg",
  "/images/c1c71f63e869c9d3bc7205249624b5de.jpg",
  "/images/672050b54fa748ad09b0f0565c9843dd.jpg",
  "/images/a8ebd8bbc507432ad09e2ea2e6ae883f.jpg",
];

/** `src/lib/images.ts` PAGE_HERO, in its declared order. */
const PAGE_HERO = {
  about: LANDSCAPE[0],
  furniture: LANDSCAPE[1],
  "custom-furniture": SQUARE[0],
  projects: SQUARE[1],
  gallery: SQUARE[2],
  services: LANDSCAPE[0],
  contact: SQUARE[1],
};

/** `src/lib/images.ts` SERVICE_IMAGES. */
const SERVICES = [
  LANDSCAPE[0],
  LANDSCAPE[1],
  SQUARE[0],
  SQUARE[1],
  SQUARE[2],
  LANDSCAPE[0],
];

/** `src/lib/images.ts` PROJECT_IMAGES. */
const PROJECTS = [
  SQUARE[0],
  SQUARE[1],
  SQUARE[2],
  LANDSCAPE[1],
  LANDSCAPE[0],
  SQUARE[0],
];

/** `src/lib/images.ts` GALLERY_IMAGES. */
const GALLERY = [
  PORTRAIT[1],
  SQUARE[0],
  SQUARE[1],
  LANDSCAPE[0],
  SQUARE[2],
  PORTRAIT[0],
  LANDSCAPE[1],
  PORTRAIT[2],
  PORTRAIT[3],
  PORTRAIT[0],
];

/**
 * Shop category panels. These were literals on `CATEGORIES` in
 * `src/lib/navigation.ts`; the panel is a wide banner, so the landscape and
 * square pools lead and the remainder round out the list.
 */
const CATEGORY_PANELS = {
  "living-room": LANDSCAPE[2],
  bedroom: LANDSCAPE[3],
  office: SQUARE[3],
  "dining-room": SQUARE[4],
  kitchen: SQUARE[5],
  outdoor: PORTRAIT[4],
  "chairs-seating": PORTRAIT[5],
  "storage-shelving": PORTRAIT[6],
  "kids-nursery": PORTRAIT[7],
  "custom-furniture": PORTRAIT[8],
};

/** The homepage carousel was inline in `Hero.tsx`; same spread, wide first. */
const HERO_SLIDES = [
  LANDSCAPE[0],
  LANDSCAPE[1],
  LANDSCAPE[2],
  LANDSCAPE[3],
  SQUARE[0],
];

/**
 * Slot key → photo, for the slots we know the original picture of. Anything not
 * listed here is inserted with a null image and renders as a placeholder until
 * an admin uploads something — which is the correct state for a decorative
 * background nobody has chosen yet.
 */
const SEED_IMAGES = {
  logo: LOGO,
  // No dedicated favicon file exists; the mark is the right mark to show at
  // 16px, and the admin can replace it with a proper one.
  favicon: LOGO,
  og_image: LANDSCAPE[0],
  intro_workshop: PORTRAIT[0],
  featured_collection: LANDSCAPE[1],
  about_workshop: PORTRAIT[1],
  custom_furniture_timber_racks: SQUARE[0],
};

/* ------------------------------------------------------------- dimensions */

import { readFileSync } from "node:fs";

/**
 * Image width/height are stored on the row so the storefront can reserve the
 * right aspect box before the file loads. Reading them off disk keeps the seed
 * cheap — there are only a couple of dozen photos.
 */
async function probe(url) {
  const file = path.join(ROOT, "public", url.replace(/^\//, ""));
  try {
    const buf = readFileSync(file);
    if (url.endsWith(".png")) {
      // PNG: IHDR width/height are the first thing in the file after the sig.
      return {
        bytes: buf.length,
        width: buf.readUInt32BE(16),
        height: buf.readUInt32BE(20),
      };
    }
    // JPEG: walk the marker chain to the first SOFn frame header.
    let offset = 2;
    while (offset < buf.length - 9) {
      if (buf[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buf[offset + 1];
      // SOF0..SOF15, excluding the DHT/JPG/DAC markers in that range.
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
        return {
          bytes: buf.length,
          height: buf.readUInt16BE(offset + 5),
          width: buf.readUInt16BE(offset + 7),
        };
      }
      offset += 2 + buf.readUInt16BE(offset + 2);
    }
  } catch {
    /* fall through — a missing file just leaves the dimensions null */
  }
  return { bytes: null, width: null, height: null };
}

/* ------------------------------------------------------------------- seed */

const { MEDIA_SLOTS, categorySlot } = await import(
  pathToFileURL(path.join(ROOT, "src", "lib", "media-slots.ts")).href
);

// Category panels are derived from the navigation list, not the static registry.
const { CATEGORIES } = await import(
  pathToFileURL(path.join(ROOT, "src", "lib", "navigation.ts")).href
);

const seeds = new Map(Object.entries(SEED_IMAGES));
HERO_SLIDES.forEach((url, i) => seeds.set(`hero_slide_${i + 1}`, url));
SERVICES.forEach((url, i) => seeds.set(`service_${i + 1}`, url));
PROJECTS.forEach((url, i) => seeds.set(`project_${i + 1}`, url));
GALLERY.forEach((url, i) => seeds.set(`gallery_${i + 1}`, url));
for (const page of Object.keys(PAGE_HERO)) seeds.set(`page_hero_${page}`, PAGE_HERO[page]);
for (const category of CATEGORIES) {
  const url = CATEGORY_PANELS[category.slug];
  if (url) seeds.set(categorySlot(category.slug), url);
}

const rows = [
  ...MEDIA_SLOTS.map((slot, i) => ({ ...slot, position: i })),
  ...CATEGORIES.map((category, i) => ({
    key: categorySlot(category.slug),
    label: `Category panel — ${category.name}`,
    group: "Categories",
    kind: "photo",
    alt: `${category.name} furniture`,
    position: 1000 + i,
  })),
];

// Cache the probes: the same photo backs several slots.
const probes = new Map();
async function dims(url) {
  if (!probes.has(url)) probes.set(url, await probe(url));
  return probes.get(url);
}

let inserted = 0;
let updated = 0;
let skipped = 0;

for (const slot of rows) {
  const url = seeds.get(slot.key) ?? null;
  const size = url ? await dims(url) : { bytes: null, width: null, height: null };

  const result = await client.query(
    `INSERT INTO media_slots
       (slot_key, label, group_name, kind, image_url, thumb_url, alt_text,
        width, height, bytes, position)
     VALUES ($1, $2, $3, $4, $5, NULL, $6, $7, $8, $9, $10)
     ON CONFLICT (slot_key) DO UPDATE SET
       label      = EXCLUDED.label,
       group_name = EXCLUDED.group_name,
       kind       = EXCLUDED.kind,
       position   = EXCLUDED.position,
       -- Only fill an empty slot. The --force flag is the escape hatch for
       -- resetting every slot back to the original photo.
       image_url  = CASE
                      WHEN $11 THEN EXCLUDED.image_url
                      WHEN media_slots.image_url IS NULL THEN EXCLUDED.image_url
                      ELSE media_slots.image_url
                    END,
       alt_text   = CASE WHEN media_slots.alt_text IS NULL OR media_slots.alt_text = ''
                         THEN EXCLUDED.alt_text
                         ELSE media_slots.alt_text END,
       width      = CASE WHEN media_slots.image_url IS NULL THEN EXCLUDED.width  ELSE media_slots.width  END,
       height     = CASE WHEN media_slots.image_url IS NULL THEN EXCLUDED.height ELSE media_slots.height END,
       bytes      = CASE WHEN media_slots.image_url IS NULL THEN EXCLUDED.bytes  ELSE media_slots.bytes  END
     RETURNING (xmax = 0) AS was_insert`,
    [
      slot.key,
      slot.label,
      slot.group,
      slot.kind,
      url,
      slot.alt || null,
      size.width,
      size.height,
      size.bytes,
      slot.position,
      FORCE,
    ],
  );

  if (result.rows[0].was_insert) inserted += 1;
  else updated += 1;
  if (!url) skipped += 1;
}

/* ------------------------------------- register the files in the library */

// The admin media grid lists uploads, not slots, so record the seeded files as
// uploads too. Keyed on `url` so re-running does not duplicate them.
const distinctUrls = [...new Set(seeds.values())];
for (const url of distinctUrls) {
  const size = await dims(url);
  const filename = path.basename(url);
  await client.query(
    `INSERT INTO media_uploads
       (filename, url, thumb_url, original_name, mime, alt_text, bytes, width, height, created_by)
     SELECT $1, $2, NULL, $3, $4, NULL, $5, $6, $7, 'seed'
      WHERE NOT EXISTS (SELECT 1 FROM media_uploads WHERE url = $2)`,
    [
      filename,
      url,
      filename,
      url.endsWith(".png") ? "image/png" : "image/jpeg",
      size.bytes,
      size.width,
      size.height,
    ],
  );
}

/* --------------------------------------------------------------- summary */

const { rows: counts } = await client.query(
  `SELECT COUNT(*)::int AS total,
          COUNT(image_url)::int AS filled,
          COUNT(*) FILTER (WHERE image_url IS NULL)::int AS empty
     FROM media_slots`,
);

console.log(`  ${inserted} slots inserted · ${updated} updated · ${skipped} left empty`);
console.log(`  media_slots: ${counts[0].filled}/${counts[0].total} filled, ${counts[0].empty} awaiting upload`);
console.log(`  media_uploads: ${distinctUrls.length} files registered`);

await client.end();
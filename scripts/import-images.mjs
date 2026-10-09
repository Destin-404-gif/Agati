#!/usr/bin/env node
/**
 * Imports the photography in `imgs/` into `public/images/`, then rewrites the
 * two places that reference those files so they can never drift apart:
 *
 *   src/lib/images.ts   the aspect-ratio pools every page picks from
 *   db/seed.sql         the same paths, mirrored as SQL string literals
 *
 * The files in `imgs/` carry no semantic name, so slots are assigned by aspect
 * ratio: the closest-fitting photo crops least under `object-cover`. Output is
 * content-hashed, resized to 1600px and re-encoded, so re-running after a new
 * shoot only rewrites what actually changed.
 *
 *   node scripts/import-images.mjs --probe    report the buckets, write nothing
 *   node scripts/import-images.mjs            import + rewrite both files
 *   node scripts/import-images.mjs --clean    also delete unreferenced output
 */
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SRC_DIR = path.join(root, "imgs");
const OUT_DIR = path.join(root, "public", "images");
const HERO_DIR = path.join(OUT_DIR, "hero");
const IMAGES_TS = path.join(root, "src", "lib", "images.ts");
const SEED_SQL = path.join(root, "db", "seed.sql");

const probe = process.argv.includes("--probe");
const clean = process.argv.includes("--clean");

/** Cap per pool so images.ts stays readable; drop the least-fitting extras. */
const CAPS = { LANDSCAPE: 6, SQUARE: 6, PORTRAIT: 12 };
const HERO_SLIDES = 5;
const MAX_EDGE = 1600;

/**
 * A photo narrower than this is too soft to fill a full-bleed banner, so it is
 * kept out of the landscape pool even when its ratio is a perfect fit. The
 * WhatsApp export caps every frame at 736px, so this is doing real work here.
 */
const BANNER_MIN_WIDTH = 600;

const BUCKETS = [
  { name: "LANDSCAPE", test: (p) => p.ratio >= 1.2 && p.ratio <= 1.6 && p.w >= BANNER_MIN_WIDTH },
  { name: "SQUARE", test: (p) => p.ratio >= 0.95 && p.ratio <= 1.06 },
  { name: "PORTRAIT", test: (p) => p.ratio >= 0.5 && p.ratio <= 0.8 },
];

/* ------------------------------------------------------------------ helpers */

const hash32 = (buf) => createHash("sha256").update(buf).digest("hex").slice(0, 32);

async function exists(p) {
  return fs.access(p).then(
    () => true,
    () => false,
  );
}

/** Reads the current pool hashes out of images.ts so old -> new can be mapped. */
async function readExistingPools() {
  if (!(await exists(IMAGES_TS))) return {};
  const src = await fs.readFile(IMAGES_TS, "utf8");
  const pools = {};
  for (const m of src.matchAll(/const\s+(\w+)\s*=\s*\[([\s\S]*?)\];/g)) {
    const hashes = [...m[2].matchAll(/p\("([0-9a-f]{32})\.jpg"\)/g)].map((h) => h[1]);
    if (hashes.length) pools[m[1]] = hashes;
  }
  return pools;
}

/* --------------------------------------------------------------------- main */

await fs.mkdir(OUT_DIR, { recursive: true });
await fs.mkdir(HERO_DIR, { recursive: true });

const entries = await fs.readdir(SRC_DIR, { withFileTypes: true });
const photoFiles = entries
  .filter((e) => e.isFile() && /\.(jpe?g|png|webp)$/i.test(e.name))
  .map((e) => e.name)
  .sort();
const logoFile = photoFiles.find((f) => /logo/i.test(f));
const photoNames = photoFiles.filter((f) => f !== logoFile);

/** Optimise + content-hash every photo. Returns { name, hash, ratio }. */
const photos = [];
for (const name of photoNames) {
  const input = path.join(SRC_DIR, name);
  const meta = await sharp(input).metadata();
  const buf = await sharp(input)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, progressive: true, mozjpeg: true })
    .toBuffer();

  const hash = hash32(buf);
  const outFile = path.join(OUT_DIR, `${hash}.jpg`);
  if (!(await exists(outFile))) await fs.writeFile(outFile, buf);

  photos.push({
    name,
    hash,
    ratio: meta.width / meta.height,
    w: meta.width,
    h: meta.height,
    bytes: buf.length,
  });
}

// Widest first, filename as tiebreak so the output is stable across runs.
photos.sort((a, b) => b.ratio - a.ratio || a.name.localeCompare(b.name));

// Byte-identical frames (a burst export often repeats one) would otherwise
// occupy two slots and show the same photo twice in a grid.
const unique = [];
const seenHash = new Map();
const duplicates = [];
for (const p of photos) {
  const first = seenHash.get(p.hash);
  if (first) {
    duplicates.push({ ...p, dupOf: first });
    continue;
  }
  seenHash.set(p.hash, p.name);
  unique.push(p);
}

const pools = {};
const overflow = {};
for (const b of BUCKETS) {
  const matches = unique.filter(b.test);
  const cap = CAPS[b.name];
  pools[b.name] = matches.slice(0, cap);
  overflow[b.name] = matches.slice(cap);
}

// A pool with nothing in it would generate "undefined.jpg" paths, so stop here.
for (const b of BUCKETS) {
  if (pools[b.name].length > 0) continue;
  console.error(`\n  FAILED: no photo fits the ${b.name} bucket.`);
  console.error("  Nothing was written. Check the photos in imgs/ and the bucket ranges above.\n");
  process.exit(1);
}

// Hero slides fill the viewport. Landscape frames crop least, so they go first;
// within a shape the bigger frame wins, because the WhatsApp export caps
// everything at 736px and a soft hero is the one thing you cannot art-direct
// around later.
const landscapeSet = new Set([...pools.LANDSCAPE, ...overflow.LANDSCAPE]);
const heroCandidates = [...landscapeSet, ...pools.SQUARE, ...overflow.SQUARE];
heroCandidates.sort(
  (a, b) =>
    Number(landscapeSet.has(b)) - Number(landscapeSet.has(a)) ||
    b.w * b.h - a.w * a.h ||
    b.ratio - a.ratio ||
    a.name.localeCompare(b.name),
);
const hero = heroCandidates.slice(0, HERO_SLIDES);
for (let i = 0; i < hero.length; i++) {
  await fs.copyFile(path.join(OUT_DIR, `${hero[i].hash}.jpg`), path.join(HERO_DIR, `slide-${i + 1}.jpg`));
}

/* -------------------------------------------------------------------- logo */

let logo = null;
if (logoFile) {
  const input = path.join(SRC_DIR, logoFile);
  const meta = await sharp(input).metadata();
  const buf = await sharp(input)
    .png({ compressionLevel: 9, quality: 92 })
    .toBuffer();
  await fs.writeFile(path.join(OUT_DIR, "agati-logo.png"), buf);
  logo = { src: "/images/agati-logo.png", w: meta.width, h: meta.height, bytes: buf.length };
}

/* ------------------------------------------------------------------ report */

console.log(`\n  ${photos.length} photos -> public/images/  (max edge ${MAX_EDGE}px)`);
console.log(`  ${unique.length} unique, ${duplicates.length} byte-identical frame(s) skipped`);
for (const d of duplicates) console.log(`      ${d.name}  ==  ${d.dupOf}`);
console.log("");
for (const b of BUCKETS) {
  const p = pools[b.name];
  console.log(`  ${b.name.padEnd(10)} ${String(p.length).padStart(2)} used`);
  for (const x of p) console.log(`      ${x.ratio.toFixed(2)}  ${x.hash}  ${x.name}`);
  if (overflow[b.name].length) {
    console.log(`      ... ${overflow[b.name].length} more in this bucket left unused`);
  }
  console.log("");
}
console.log(`  HERO       ${hero.length} slides`);
for (let i = 0; i < hero.length; i++) {
  const soft = hero[i].w < BANNER_MIN_WIDTH ? "  <- narrow, will look soft full-bleed" : "";
  console.log(`      slide-${i + 1}.jpg  ${hero[i].w}x${hero[i].h}  ${hero[i].ratio.toFixed(2)}  ${hero[i].name}${soft}`);
}
const narrow = unique.filter((p) => p.w < BANNER_MIN_WIDTH).length;
if (narrow) {
  console.log(`\n  WARNING: ${narrow}/${unique.length} photos are under ${BANNER_MIN_WIDTH}px wide.`);
  console.log("  WhatsApp re-encodes on export, so anything sent through it loses resolution.");
  console.log("  Drop the camera originals into imgs/ for a full-bleed hero, then re-run.\n");
}
if (logo) console.log(`\n  LOGO       ${logo.src}  ${logo.w}x${logo.h}  ${(logo.bytes / 1024).toFixed(0)}kb\n`);

if (probe) {
  console.log("  --probe, nothing written.\n");
  process.exit(0);
}

/* ------------------------------------------------- rewrite src/lib/images.ts */

const oldPools = await readExistingPools();

const fmt = (arr) =>
  arr.map((x) => `  p("${x.hash}.jpg"), // ${x.w}x${x.h}  ${x.ratio.toFixed(2)}  ${x.name}`).join("\n");

const L = pools.LANDSCAPE;
const S = pools.SQUARE;
const P = pools.PORTRAIT;

const ts = `/**
 * Local photography, single-sourced.
 *
 * The files in \`imgs/\` are content-hashed, so they carry no semantic name.
 * Every slot below is therefore assigned by aspect ratio: the closest-fitting
 * photo crops least under \`object-cover\`. There are more slots than photos,
 * so a few repeat — if you drop more landscape shots into \`imgs/\`, re-run
 * \`npm run imgs\` and widen LANDSCAPE below.
 *
 * GENERATED by scripts/import-images.mjs — do not edit by hand.
 */

const p = (file: string) => \`/images/\${file}\`;

/* Landscape 1.21–1.50 — banners, page heroes, wide gallery tiles. */
const LANDSCAPE = [
${fmt(L)}
];

/* Square 1.0 — standard gallery tiles and card-safe crops. */
const SQUARE = [
${fmt(S)}
];

/* Portrait 0.53–0.80 — products, variants, categories, tall tiles. */
const PORTRAIT = [
${fmt(P)}
];

/** The Agati mark, served from public/images. */
export const LOGO = ${logo ? `p("agati-logo.png")` : `"#"`};

/** Homepage. */
export const HERO = LANDSCAPE[0];
export const INTRO = PORTRAIT[0];
export const FEATURED = LANDSCAPE[1] ?? LANDSCAPE[0];
export const WORKSHOP = PORTRAIT[1] ?? PORTRAIT[0];
export const TIMBER_RACKS = SQUARE[0] ?? PORTRAIT[0];

/** One banner per page so no two pages open on the same photo. */
export const PAGE_HERO = {
  about: LANDSCAPE[0],
  furniture: LANDSCAPE[1] ?? LANDSCAPE[0],
  "custom-furniture": SQUARE[0] ?? LANDSCAPE[0],
  projects: SQUARE[1] ?? SQUARE[0],
  gallery: SQUARE[2] ?? SQUARE[1] ?? SQUARE[0],
  services: LANDSCAPE[0],
  contact: SQUARE[1] ?? SQUARE[0],
} as const;

/* data.ts — ordered to match the editorial arrays they feed. */
export const SERVICE_IMAGES = [
  LANDSCAPE[0],
  LANDSCAPE[1] ?? LANDSCAPE[0],
  SQUARE[0] ?? LANDSCAPE[0],
  SQUARE[1] ?? SQUARE[0],
  SQUARE[2] ?? SQUARE[1] ?? SQUARE[0],
  LANDSCAPE[0],
];

export const PROJECT_IMAGES = [
  SQUARE[0] ?? PORTRAIT[0],
  SQUARE[1] ?? SQUARE[0] ?? PORTRAIT[0],
  SQUARE[2] ?? SQUARE[1] ?? SQUARE[0],
  LANDSCAPE[1] ?? LANDSCAPE[0],
  LANDSCAPE[0],
  SQUARE[0] ?? PORTRAIT[0],
];

/** Matches GALLERY order: tall, std, std, wide, std, std, wide, std, std, tall. */
export const GALLERY_IMAGES = [
  PORTRAIT[1] ?? PORTRAIT[0],
  SQUARE[0] ?? LANDSCAPE[0],
  SQUARE[1] ?? SQUARE[0] ?? LANDSCAPE[0],
  LANDSCAPE[0],
  SQUARE[2] ?? SQUARE[1] ?? SQUARE[0],
  PORTRAIT[0],
  LANDSCAPE[1] ?? LANDSCAPE[0],
  PORTRAIT[2] ?? PORTRAIT[0],
  PORTRAIT[3] ?? PORTRAIT[0],
  PORTRAIT[0],
];

/* db/seed.sql — mirrored there as literal paths. */
export const CATEGORY_IMAGES = [PORTRAIT[0], PORTRAIT[1] ?? PORTRAIT[0], PORTRAIT[4] ?? PORTRAIT[0]];

/** 19 rows, one per product_images entry, in seed order. */
export const PRODUCT_IMAGES = Array.from({ length: 19 }, (_, i) => PORTRAIT[i % PORTRAIT.length]);

/**
 * 13 rows, one per product_variants entry. A colourway reuses its own
 * product's front photo rather than an unrelated one, so the detail view
 * never shows a variant that contradicts the product beside it.
 */
export const VARIANT_IMAGES = [
  PRODUCT_IMAGES[0],
  PRODUCT_IMAGES[0],
  PRODUCT_IMAGES[0],
  PRODUCT_IMAGES[3],
  PRODUCT_IMAGES[3],
  PRODUCT_IMAGES[7],
  PRODUCT_IMAGES[7],
  PRODUCT_IMAGES[7],
  PRODUCT_IMAGES[12],
  PRODUCT_IMAGES[12],
  PRODUCT_IMAGES[12],
  PRODUCT_IMAGES[17],
  PRODUCT_IMAGES[17],
];
`;

await fs.writeFile(IMAGES_TS, ts);
console.log("  wrote src/lib/images.ts\n");

/* --------------------------------------------------- rewrite db/seed.sql */

// Old pool index i maps to new pool index i: both are sorted widest-first, so
// the closest-aspect-ratio replacement keeps repeated paths repeated.
const oldToNew = new Map();
for (const b of BUCKETS) {
  const olds = oldPools[b.name] ?? [];
  const news = [...pools[b.name], ...overflow[b.name]];
  olds.forEach((hash, i) => {
    const next = news[i];
    if (next && next.hash !== hash) oldToNew.set(hash, next.hash);
  });
}

if (await exists(SEED_SQL)) {
  let sql = await fs.readFile(SEED_SQL, "utf8");
  let touched = 0;
  for (const [oldHash, newHash] of oldToNew) {
    const needle = `${oldHash}.jpg`;
    if (!sql.includes(needle)) continue;
    touched += sql.split(needle).length - 1;
    sql = sql.split(needle).join(`${newHash}.jpg`);
  }
  await fs.writeFile(SEED_SQL, sql);
  console.log(`  rewrote ${touched} path literals in db/seed.sql`);
  console.log(`  (${oldToNew.size} of ${photos.length} photos are new to the catalogue)\n`);
}

/* ------------------------------------------------------------------- clean */

if (clean) {
  const referenced = new Set([
    ...photos.map((x) => `${x.hash}.jpg`),
    ...(logo ? ["agati-logo.png"] : []),
  ]);
  const files = await fs.readdir(OUT_DIR);
  let removed = 0;
  for (const f of files) {
    if (f.endsWith(".jpg") && !referenced.has(f)) {
      await fs.rm(path.join(OUT_DIR, f));
      removed++;
    }
  }
  const oldHero = await fs.readdir(HERO_DIR).catch(() => []);
  for (let i = hero.length + 1; i <= oldHero.length; i++) {
    const f = `slide-${i}.jpg`;
    if (oldHero.includes(f)) {
      await fs.rm(path.join(HERO_DIR, f));
      removed++;
    }
  }
  console.log(`  removed ${removed} unreferenced file(s)\n`);
}

console.log("  done. re-run `npm run db:seed` to point the database at the new photos.\n");

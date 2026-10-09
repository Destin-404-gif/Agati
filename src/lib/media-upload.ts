/**
 * Upload handling for the media library.
 *
 * Every admin image goes through here: validate the declared type, re-encode
 * through sharp so the bytes are known-good, write a thumbnail, and register the
 * file so it can be re-assigned later. Nothing trusts the client's MIME type or
 * the original filename.
 *
 * Server-only (uses `node:fs` and sharp).
 */

import { randomBytes } from "node:crypto";
import { mkdir, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { query } from "./db";
import {
  IMAGE_VARIANT_WIDTHS,
  MAX_UPLOAD_BYTES,
  qualityTier,
  type ImageVariant,
  type QualityTier,
} from "./image-variants";
import { slotDef, type MediaKind } from "./media-slots";

export { MAX_UPLOAD_BYTES };

const RASTER_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SVG_TYPE = "image/svg+xml";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Where the served variants live. Every size below is written here.
 *
 * Deliberately *not* inside `public/`. `next start` reads the public folder once,
 * at boot, into an in-memory set (`setupFsCheck` in
 * `next/dist/server/lib/router-utils/filesystem.js`) and memoises the misses, so a
 * file written after startup is a permanent 404 until the server restarts. Admin
 * uploads are created while the server is already running, so they have to live
 * outside `public/` and be served by the `/uploads/[...path]` route handler.
 */
export const UPLOAD_DIR = path.join(process.cwd(), "storage", "uploads");

/**
 * The untouched original, kept outside `public/` so it is never served directly.
 * It lets `npm run reprocess-images` rebuild every variant from the source pixels
 * without asking the admin to upload again.
 */
export const ORIGINALS_DIR = path.join(process.cwd(), "storage", "originals");

/**
 * At most this many sharp pipelines run at once, so a twenty-photo drop cannot
 * exhaust the server's memory. The rest queue up and start as slots free.
 */
const MAX_CONCURRENT_ENCODES = 3;
let activeEncodes = 0;
const encodeQueue: (() => void)[] = [];

async function withEncodeSlot<T>(run: () => Promise<T>): Promise<T> {
  if (activeEncodes >= MAX_CONCURRENT_ENCODES) {
    await new Promise<void>((resolve) => encodeQueue.push(resolve));
  }
  activeEncodes += 1;
  try {
    return await run();
  } finally {
    activeEncodes -= 1;
    encodeQueue.shift()?.();
  }
}

export interface PreparedUpload {
  id: number;
  /** The largest generated variant - the "full" image. */
  url: string;
  /** The 400px variant (or the only file, for a small upload). */
  thumbUrl: string;
  originalName: string;
  filename: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  /** The source pixels, before any resize. */
  originalWidth: number | null;
  originalHeight: number | null;
  /** Relative path of the private original, for reprocessing. */
  originalPath: string | null;
  /** Every file written, ascending by width. */
  variants: ImageVariant[];
  variant400Url: string | null;
  variant1200Url: string | null;
  variant2560Url: string | null;
  variant3840Url: string | null;
  qualityTier: QualityTier;
}

export type UploadResult =
  | { ok: true; upload: PreparedUpload }
  | { ok: false; error: string };

/** Types a given slot will take. Vector slots (the logo, the favicon) also allow SVG. */
export function allowedTypesFor(slotKey: string | null): Set<string> {
  const def = slotKey ? slotDef(slotKey) : undefined;
  const kinds: MediaKind[] = def ? [def.kind] : ["photo"];
  const types = new Set(RASTER_TYPES);
  if (kinds.includes("vector")) types.add(SVG_TYPE);
  return types;
}

/**
 * Identify the format from the file's own magic bytes, so a mislabelled or
 * type-less upload is judged on what it actually is. Returns null when nothing
 * matches, which lets the caller fall back to the declared type.
 */
function sniffMime(raw: Buffer): string | null {
  if (raw.length >= 3 && raw[0] === 0xff && raw[1] === 0xd8 && raw[2] === 0xff) {
    return "image/jpeg";
  }
  if (raw.length >= 8 && raw.subarray(0, 8).equals(PNG_SIGNATURE)) {
    return "image/png";
  }
  if (
    raw.length >= 12 &&
    raw.subarray(0, 4).toString("ascii") === "RIFF" &&
    raw.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  // SVG is text: only treat it as such if it parses as markup starting with an
  // <svg> root. validateSvg() still vets the contents.
  const head = raw.subarray(0, 1024).toString("utf8").trimStart();
  if (head.startsWith("<svg") || head.startsWith("<?xml") || head.startsWith("<!")) {
    return SVG_TYPE;
  }
  return null;
}

/**
 * SVG is XML that can carry script, so an uploaded one is only accepted if it
 * looks like a plain drawing. This is a denylist rather than an allowlist
 * because real logos use constructs an allowlist would reject; everything on the
 * list is something no legitimate logo needs.
 */
const SVG_FORBIDDEN = [
  /<script/i,
  /<foreignObject/i,
  /<iframe/i,
  /<embed/i,
  /<object/i,
  /<use\b[^>]*\b(xlink:)?href\s*=\s*["']?\s*(https?:)?\/\//i,
  /<image\b[^>]*\b(xlink:)?href\s*=\s*["']?\s*(?!data:image\/)/i,
  /\son[a-z]+\s*=/i,
  /javascript\s*:/i,
  /data:text\/html/i,
  /<!ENTITY/i,
  /<!DOCTYPE[^>]*\[/i,
  /<a\b[^>]*\b(xlink:)?href\s*=\s*["']?\s*javascript/i,
];

export function validateSvg(text: string): string | null {
  const trimmed = text.trim();

  // An SVG without a root <svg> element is not an SVG. Accept only the
  // documented prologue shapes: optional XML declaration, optional comments,
  // optional doctype, then the <svg> root.
  const root =
    /^(?:\s*<\?xml[\s\S]*?\?>)?\s*(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg[\s>]/i;

  if (!root.test(trimmed)) {
    return "That file is not an SVG image.";
  }

  for (const pattern of SVG_FORBIDDEN) {
    if (pattern.test(trimmed)) {
      return "That SVG contains scripting or external references, which are not allowed.";
    }
  }

  // `<style>` can carry an @import or a remote url() fetch; harmless logos
  // inline their styles, so a remote reference is always a red flag.
  if (/<style[\s>]/i.test(trimmed) && /url\(\s*['"]?(https?:)?\/\//i.test(trimmed)) {
    return "That SVG references an external stylesheet, which is not allowed.";
  }

  return null;
}

/**
 * Build a filesystem-safe, collision-proof name. The client's filename is only
 * ever recorded for display - it never reaches the filesystem, so a name like
 * `../../etc/passwd` or one with a null byte is not reachable.
 */
function safeBase(): string {
  return `${Date.now().toString(36)}-${randomBytes(6).toString("hex")}`;
}

/**
 * Render one file per bucket in `IMAGE_VARIANT_WIDTHS`.
 *
 * Always `inside` + `withoutEnlargement`, so a 800px photo is never blown up to
 * 3840 - upscaling only adds blur. A bucket that would land on the same pixels
 * as the previous one is skipped, which is why a small upload ends up with a
 * handful of distinct files instead of four identical copies.
 */
async function renderVariants(
  raw: Buffer,
  lossless: boolean,
): Promise<{
  variants: { width: number; bytes: number; buffer: Buffer }[];
  originalWidth: number;
  originalHeight: number;
}> {
  const meta = await sharp(raw, { failOn: "error" }).metadata();
  const storedWidth = meta.width ?? 0;
  const storedHeight = meta.height ?? 0;

  // EXIF orientations 5-8 rotate by a quarter turn, swapping the displayed axes.
  const swapsAxes = (meta.orientation ?? 1) >= 5;
  const originalWidth = swapsAxes ? storedHeight : storedWidth;
  const originalHeight = swapsAxes ? storedWidth : storedHeight;
  const longest = Math.max(originalWidth, originalHeight) || Math.max(...IMAGE_VARIANT_WIDTHS);

  const variants: { width: number; bytes: number; buffer: Buffer }[] = [];
  let previousEdge = 0;

  for (const target of IMAGE_VARIANT_WIDTHS) {
    const edge = Math.min(target, longest);
    if (edge <= previousEdge) continue;
    previousEdge = edge;

    const pipeline = sharp(raw, { failOn: "error" })
      // Bake the EXIF rotation, then drop every other tag. sharp strips EXIF/GPS
      // by default, so location and camera data never reach the public file, and
      // `.toColourspace("srgb")` re-renders into the device-independent sRGB
      // space so colours stay correct without carrying a profile forward.
      .rotate()
      .toColourspace("srgb")
      .resize({
        width: target,
        height: target,
        fit: "inside",
        withoutEnlargement: true,
        kernel: "lanczos3",
      });

    const quality = target >= 2560 ? 92 : 90;
    const buffer = lossless
      ? // Graphics and logos: lossless PNG, no generation loss at all.
        await pipeline.png({ compressionLevel: 9, effort: 7, adaptiveFiltering: true }).toBuffer()
      : // Photographs: high-quality WebP, never below q90.
        await pipeline.webp({ quality, effort: 5, smartSubsample: true }).toBuffer();

    const out = await sharp(buffer).metadata();
    variants.push({ width: out.width ?? edge, bytes: buffer.byteLength, buffer });
  }

  return { variants, originalWidth, originalHeight };
}

/**
 * Validate, re-encode and store an uploaded file.
 *
 * `slotKey` is advisory but meaningful: it decides whether an SVG is acceptable,
 * and it is what the admin UI passes so the wrong kind of file cannot be
 * dropped into the logo.
 */
export async function storeUpload(
  file: File,
  slotKey: string | null,
  staffEmail: string,
): Promise<UploadResult> {
  const allowed = allowedTypesFor(slotKey);

  if (file.size > MAX_UPLOAD_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      error: `That file is ${mb}MB. The limit is 25MB per image - resize it and try again.`,
    };
  }

  const raw = Buffer.from(await file.arrayBuffer());

  // The browser always sends a MIME type, but it is client-supplied input and a
  // script hitting this endpoint can send anything. Decide the format from the
  // bytes, falling back to the declared type only when the content is opaque.
  const mime = sniffMime(raw) ?? file.type;

  if (!allowed.has(mime)) {
    return {
      ok: false,
      error: allowed.has(SVG_TYPE)
        ? "Use a JPG, PNG, WebP or SVG image."
        : "Use a JPG, PNG or WebP image.",
    };
  }

  if (mime === SVG_TYPE) {
    const problem = validateSvg(raw.toString("utf8"));
    if (problem) return { ok: false, error: problem };

    const name = `${safeBase()}.svg`;
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, name), raw);

    // An SVG scales, so every "variant" is the same file - browsers rasterise it
    // at whatever size the page asks for. The file itself is already vector and
    // lossless, so there is nothing to resize and no original to keep.
    const url = `/uploads/${name}`;
    const upload: PreparedUpload = {
      id: 0,
      url,
      thumbUrl: url,
      originalName: file.name.slice(0, 255),
      filename: name,
      mime: SVG_TYPE,
      bytes: raw.byteLength,
      width: null,
      height: null,
      originalWidth: null,
      originalHeight: null,
      originalPath: null,
      variants: [],
      variant400Url: url,
      variant1200Url: url,
      variant2560Url: url,
      variant3840Url: url,
      qualityTier: "4k",
    };

    const inserted = await recordUpload(upload, staffEmail);
    upload.id = inserted.id;
    return { ok: true, upload };
  }

  // Re-encode rather than trusting the extension or the client's MIME type. A
  // file that is not really an image throws here, inside sharp.
  const lossless = mime === "image/png";

  let rendered: { width: number; bytes: number; buffer: Buffer }[];
  let originalWidth: number;
  let originalHeight: number;

  try {
    ({ variants: rendered, originalWidth, originalHeight } = await withEncodeSlot(() =>
      renderVariants(raw, lossless),
    ));
  } catch {
    return { ok: false, error: "That file could not be decoded as an image." };
  }

  const base = safeBase();
  const ext = lossless ? "png" : "webp";
  const written: ImageVariant[] = [];

  await mkdir(UPLOAD_DIR, { recursive: true });
  try {
    for (const variant of rendered) {
      const name = `${base}-w${variant.width}.${ext}`;
      await writeFile(path.join(UPLOAD_DIR, name), variant.buffer);
      written.push({ width: variant.width, url: `/uploads/${name}`, bytes: variant.bytes });
    }
  } catch {
    // A half-written set would leave the database pointing at files that are not
    // all there, so undo this upload's files before reporting the failure.
    await removeStoredFiles([`/uploads/${base}-w1.${ext}`]);
    return { ok: false, error: "The image could not be saved. Try again." };
  }

  // Keep a private, untouched copy so the variants can be rebuilt later.
  const originalExt = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const originalRel = `storage/originals/${base}.${originalExt}`;
  await mkdir(ORIGINALS_DIR, { recursive: true });
  await writeFile(path.join(process.cwd(), originalRel), raw);

  const largest = written[written.length - 1]!;
  const smallest = written[0]!;
  /** The best file for a bucket: the widest that still fits, else the largest. */
  const atBucket = (target: number): string => {
    const under = written.filter((v) => v.width <= target);
    return (under.length > 0 ? under[under.length - 1]! : largest).url;
  };

  const upload: PreparedUpload = {
    id: 0,
    url: largest.url,
    thumbUrl: smallest.url,
    originalName: file.name.slice(0, 255),
    filename: path.basename(largest.url),
    mime: lossless ? "image/png" : "image/webp",
    bytes: largest.bytes ?? 0,
    width: largest.width,
    height:
      originalWidth > 0 ? Math.round((largest.width / originalWidth) * originalHeight) : null,
    originalWidth,
    originalHeight,
    originalPath: originalRel,
    variants: written,
    variant400Url: atBucket(400),
    variant1200Url: atBucket(1200),
    variant2560Url: atBucket(2560),
    variant3840Url: atBucket(3840),
    qualityTier: qualityTier(Math.max(originalWidth, originalHeight)),
  };

  const inserted = await recordUpload(upload, staffEmail);
  upload.id = inserted.id;
  return { ok: true, upload };
}

/**
 * Files live on disk with generated names, so cleanup goes by url.
 *
 * Every variant of one upload shares a base (`<base>-w400.webp`, `<base>-w3840.webp`,
 * and the private original `storage/originals/<base>.<ext>`), so removing any one
 * of them removes the whole set - a replace or a delete can never leave orphaned
 * variants behind.
 *
 * Exported because every "replace this picture" flow has to delete the file it
 * just orphaned: a category, a subcategory and a gallery item all point at a
 * row in `media_uploads`, and leaving the old bytes behind would slowly fill
 * `storage/uploads` with images nothing references.
 */
async function removeBase(base: string): Promise<void> {
  if (!/^[\w.-]+$/.test(base)) return;
  await Promise.all([removeBaseIn(UPLOAD_DIR, base), removeBaseIn(ORIGINALS_DIR, base)]);
}

async function removeBaseIn(dir: string, base: string): Promise<void> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return; // the directory does not exist yet
  }
  const targets = names.filter(
    (name) => name === base || name.startsWith(`${base}-`) || name.startsWith(`${base}.`),
  );
  await Promise.all(targets.map((name) => unlink(path.join(dir, name)).catch(() => {})));
}

/** Remove every stored file belonging to the uploads behind these urls. */
export async function removeStoredFiles(urls: (string | null)[]): Promise<void> {
  const bases = new Set<string>();
  for (const url of urls) {
    if (!url || !url.startsWith("/uploads/")) continue;
    // `path.basename` collapses a traversal string, so a stored url cannot reach
    // outside the upload directory.
    const name = path.basename(url);
    if (!/^[\w.-]+$/.test(name)) continue;
    const base = name.replace(/(-w\d+)?\.(?:webp|png|jpe?g|avif|svg)$/i, "");
    bases.add(base);
  }
  await Promise.all([...bases].map(removeBase));
}

/** Remove one upload's whole variant set, given its base name. */
export async function removeVariantSet(base: string): Promise<void> {
  await removeBase(base);
}

async function recordUpload(upload: PreparedUpload, staffEmail: string) {
  const r = await query<{ id: number }>(
    `INSERT INTO media_uploads
       (filename, url, thumb_url, original_name, mime, bytes, width, height,
        original_width, original_height, original_path,
        variant_400_url, variant_1200_url, variant_2560_url, variant_3840_url, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     RETURNING id`,
    [
      upload.filename,
      upload.url,
      upload.thumbUrl,
      upload.originalName,
      upload.mime,
      upload.bytes,
      upload.width,
      upload.height,
      upload.originalWidth,
      upload.originalHeight,
      upload.originalPath,
      upload.variant400Url,
      upload.variant1200Url,
      upload.variant2560Url,
      upload.variant3840Url,
      staffEmail,
    ],
  );
  return r[0];
}

/**
 * Drop an upload from the library. Refuses while any slot still points at it,
 * so the storefront can never be left rendering a deleted file.
 */
export async function deleteUpload(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Usage is checked first: deleting the row and then trying to undo it would
  // lose the file's metadata, and the race window is not worth taking.
  const existing = await query<{ url: string; thumb_url: string | null }>(
    `SELECT url, thumb_url FROM media_uploads WHERE id = $1`,
    [id],
  );
  const row = existing[0];
  if (!row) return { ok: false, error: "That upload no longer exists." };

  const stillUsed = await query<{ slot_key: string }>(
    `SELECT slot_key FROM media_slots WHERE image_url = $1 OR thumb_url = $1`,
    [row.url],
  );
  if (stillUsed.length > 0) {
    return {
      ok: false,
      error: `That image is still used by “${stillUsed[0].slot_key}”. Point the slot somewhere else first.`,
    };
  }

  await query(`DELETE FROM media_uploads WHERE id = $1`, [id]);
  await removeStoredFiles([row.url, row.thumb_url]);
  return { ok: true };
}

/**
 * Guard for the "replace this picture" flows: a slot, a category, a subcategory,
 * a menu image, a product or a gallery item that still points at the file means
 * it must not be deleted, or the storefront would render a broken image.
 */
export async function isUploadStillReferenced(url: string): Promise<boolean> {
  const rows = await query<{ found: number }>(
    `SELECT 1 AS found FROM media_slots WHERE image_url = $1 OR thumb_url = $1
     UNION ALL
     SELECT 1 FROM categories WHERE image_url = $1
     UNION ALL
     SELECT 1 FROM subcategories WHERE image_url = $1
     UNION ALL
     SELECT 1 FROM product_images WHERE image_url = $1
     UNION ALL
     SELECT 1 FROM menu_images WHERE image_path = $1
     UNION ALL
     SELECT 1 FROM gallery_items WHERE image_url = $1 OR thumbnail_url = $1
     LIMIT 1`,
    [url],
  );
  return rows.length > 0;
}
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

import { createHash, randomBytes } from "node:crypto";
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

/* ------------------------------------------------------------- cloudinary */

/**
 * Cloudinary credentials, read from the environment.
 *
 * Present in production (and in any local setup pointed at an account). Absent
 * otherwise, in which case `storeUpload` falls back to the on-disk
 * `storage/uploads` path so `npm run dev` keeps working without a cloud account.
 * In production the fallback is refused outright - an ephemeral disk silently
 * losing pictures is exactly the failure this module now exists to prevent.
 */
export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export function cloudinaryConfig(): CloudinaryConfig | null {
  // `CLOUDINARY_URL` (cloudinary://key:secret@cloud) is accepted too, so a
  // single copied connection string is enough.
  const url = process.env.CLOUDINARY_URL?.trim();
  if (url) {
    try {
      const parsed = new URL(url);
      const cloudName = parsed.hostname;
      const apiKey = decodeURIComponent(parsed.username);
      const apiSecret = decodeURIComponent(parsed.password);
      if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret };
    } catch {
      // fall through to the individual variables
    }
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (cloudName && apiKey && apiSecret) return { cloudName, apiKey, apiSecret };
  return null;
}

/** Every upload lands in this Cloudinary folder, keeping the account tidy. */
const CLOUDINARY_FOLDER = "agati";

/**
 * Cloudinary's signature: every signable parameter (everything except `file`,
 * `api_key`, `cloud_name`, `resource_type` and `signature`), sorted by key,
 * joined `k=v&…`, with the API secret appended and SHA-1 hashed.
 */
function cloudinarySignature(params: Record<string, string>, apiSecret: string): string {
  const signable = Object.keys(params)
    .filter(
      (key) =>
        params[key] !== undefined &&
        params[key] !== null &&
        !["file", "api_key", "cloud_name", "resource_type", "signature"].includes(key),
    )
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return createHash("sha1").update(signable + apiSecret).digest("hex");
}

interface CloudinaryUpload {
  secureUrl: string;
  publicId: string;
  bytes: number | null;
}

/**
 * Upload one buffer to Cloudinary and return its public HTTPS url and id.
 *
 * Talks to the REST endpoint with a signed multipart body instead of pulling in
 * the SDK, so the app carries no extra runtime dependency. `format` fixes the
 * stored format; the public id carries no extension, which is how Cloudinary
 * expects it.
 */
async function uploadToCloudinary(
  config: CloudinaryConfig,
  buffer: Buffer,
  options: { publicId: string; format: string; contentType: string },
): Promise<CloudinaryUpload> {
  const params: Record<string, string> = {
    folder: CLOUDINARY_FOLDER,
    format: options.format,
    invalidate: "true",
    overwrite: "true",
    public_id: options.publicId,
    timestamp: String(Math.floor(Date.now() / 1000)),
    unique_filename: "false",
  };
  params.api_key = config.apiKey;
  params.signature = cloudinarySignature({ ...params }, config.apiSecret);

  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: options.contentType }),
    `${options.publicId}.${options.format}`,
  );
  for (const [key, value] of Object.entries(params)) form.append(key, value);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, {
    method: "POST",
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as {
    secure_url?: string;
    public_id?: string;
    bytes?: number;
    error?: { message?: string };
  };
  if (!res.ok || !data.secure_url || !data.public_id) {
    throw new Error(data.error?.message ?? `Cloudinary upload failed (${res.status}).`);
  }
  return {
    secureUrl: data.secure_url,
    publicId: data.public_id,
    bytes: data.bytes ?? null,
  };
}

/** Delete one Cloudinary asset by public id. A missing asset is not an error. */
async function destroyInCloudinary(config: CloudinaryConfig, publicId: string): Promise<void> {
  try {
    const params: Record<string, string> = {
      public_id: publicId,
      timestamp: String(Math.floor(Date.now() / 1000)),
    };
    params.api_key = config.apiKey;
    params.signature = cloudinarySignature({ ...params }, config.apiSecret);

    const form = new FormData();
    for (const [key, value] of Object.entries(params)) form.append(key, value);

    await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, {
      method: "POST",
      body: form,
    });
  } catch (err) {
    console.error("[media-upload] Cloudinary delete failed", publicId, err);
  }
}

/**
 * The public id encoded in a Cloudinary delivery url: everything after the
 * `/v<version>/` segment, minus the extension. Works for the pristine
 * `secure_url` and for any `w_*` transformed variant of it, so replacing or
 * deleting a picture cleans up the one asset behind every size.
 */
export function cloudinaryPublicIdFromUrl(url: string): string | null {
  const match = /res\.cloudinary\.com\/[^/]+\/image\/upload\/(.+)$/i.exec(url);
  if (!match) return null;
  const segments = match[1]!.split("/");
  const versionAt = segments.findIndex((segment) => /^v\d+$/.test(segment));
  const idPart = versionAt >= 0 ? segments.slice(versionAt + 1).join("/") : match[1]!;
  const withoutExt = idPart.replace(/\.[a-z0-9]+$/i, "");
  return withoutExt || null;
}

/**
 * Re-encode the bytes into one high-definition master, at full resolution.
 *
 * Photographs become high-quality WebP (q92) and graphics stay lossless PNG,
 * matching the local pipeline's quality without ever downscaling - the
 * responsive sizes are produced later by Cloudinary URL transforms, so the
 * master has to keep every source pixel.
 */
async function renderMaster(
  raw: Buffer,
  lossless: boolean,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const pipeline = sharp(raw, { failOn: "error" }).rotate().toColourspace("srgb");
  const buffer = lossless
    ? await pipeline.png({ compressionLevel: 9, effort: 7, adaptiveFiltering: true }).toBuffer()
    : await pipeline.webp({ quality: 92, effort: 5, smartSubsample: true }).toBuffer();
  const meta = await sharp(buffer).metadata();
  return { buffer, width: meta.width ?? 0, height: meta.height ?? 0 };
}

/** The responsive buckets that actually exist for an image of this size. */
function variantWidthsFor(longest: number): number[] {
  const widths = IMAGE_VARIANT_WIDTHS.filter((width) => width <= longest);
  return widths.length > 0 ? [...widths] : [longest || IMAGE_VARIANT_WIDTHS[0]];
}

/**
 * A Cloudinary delivery url for one responsive width, derived from the master's
 * `secure_url` by inserting a transform. `c_limit` never enlarges, q90 keeps the
 * picture high-definition, and `f_auto` lets Cloudinary pick the best format the
 * browser accepts - all without storing another copy.
 */
function cloudinaryTransformUrl(secureUrl: string, width: number, lossless: boolean): string {
  const transform = lossless ? `w_${width},c_limit` : `w_${width},c_limit,q_90,f_auto`;
  return secureUrl.replace("/image/upload/", `/image/upload/${transform}/`);
}

function cloudinaryError(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  return message
    ? `The image could not be uploaded to storage: ${message}`
    : "The image could not be uploaded to storage. Try again.";
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

  const cloud = cloudinaryConfig();
  if (!cloud && process.env.NODE_ENV === "production") {
    return {
      ok: false,
      error:
        "Image storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
    };
  }

  const base = safeBase();

  // -------------------------------------------------------------------- SVG
  if (mime === SVG_TYPE) {
    const problem = validateSvg(raw.toString("utf8"));
    if (problem) return { ok: false, error: problem };

    let url: string;
    let originalPath: string | null = null;
    let bytes = raw.byteLength;

    if (cloud) {
      try {
        const uploaded = await uploadToCloudinary(cloud, raw, {
          publicId: base,
          format: "svg",
          contentType: SVG_TYPE,
        });
        url = uploaded.secureUrl;
        originalPath = uploaded.publicId;
        bytes = uploaded.bytes ?? raw.byteLength;
      } catch (err) {
        return { ok: false, error: cloudinaryError(err) };
      }
    } else {
      const name = `${base}.svg`;
      await mkdir(UPLOAD_DIR, { recursive: true });
      await writeFile(path.join(UPLOAD_DIR, name), raw);
      url = `/uploads/${name}`;
    }

    // An SVG scales, so every "variant" is the same file - browsers rasterise it
    // at whatever size the page asks for. The file itself is already vector and
    // lossless, so there is nothing to resize and no original to keep.
    const upload: PreparedUpload = {
      id: 0,
      url,
      thumbUrl: url,
      originalName: file.name.slice(0, 255),
      filename: cloud ? `${base}.svg` : path.basename(url),
      mime: SVG_TYPE,
      bytes,
      width: null,
      height: null,
      originalWidth: null,
      originalHeight: null,
      originalPath,
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

  // ----------------------------------------------------------------- raster
  const lossless = mime === "image/png";
  const ext = lossless ? "png" : "webp";

  if (cloud) return storeRasterInCloud(cloud, raw, base, ext, lossless, file, staffEmail);
  return storeRasterOnDisk(raw, base, ext, lossless, mime, file, staffEmail);
}

/** Production path: one HD master in Cloudinary, responsive sizes by URL. */
async function storeRasterInCloud(
  cloud: CloudinaryConfig,
  raw: Buffer,
  base: string,
  ext: string,
  lossless: boolean,
  file: File,
  staffEmail: string,
): Promise<UploadResult> {
  let master: { buffer: Buffer; width: number; height: number };
  try {
    master = await withEncodeSlot(() => renderMaster(raw, lossless));
  } catch {
    return { ok: false, error: "That file could not be decoded as an image." };
  }

  let uploaded: CloudinaryUpload;
  try {
    uploaded = await uploadToCloudinary(cloud, master.buffer, {
      publicId: base,
      format: ext,
      contentType: lossless ? "image/png" : "image/webp",
    });
  } catch (err) {
    return { ok: false, error: cloudinaryError(err) };
  }

  const longest = Math.max(master.width, master.height) || Math.max(...IMAGE_VARIANT_WIDTHS);
  const written: ImageVariant[] = variantWidthsFor(longest).map((width) => ({
    width,
    url: cloudinaryTransformUrl(uploaded.secureUrl, width, lossless),
  }));

  const largest = written[written.length - 1]!;
  const smallest = written[0]!;
  /** The best transform for a bucket: the widest that still fits, else the largest. */
  const atBucket = (target: number): string => {
    const under = written.filter((variant) => variant.width <= target);
    return (under.length > 0 ? under[under.length - 1]! : largest).url;
  };

  const upload: PreparedUpload = {
    id: 0,
    url: uploaded.secureUrl,
    thumbUrl: smallest.url,
    originalName: file.name.slice(0, 255),
    filename: `${base}.${ext}`,
    mime: lossless ? "image/png" : "image/webp",
    bytes: uploaded.bytes ?? master.buffer.byteLength,
    width: master.width,
    height: master.height,
    originalWidth: master.width,
    originalHeight: master.height,
    originalPath: uploaded.publicId,
    variants: written,
    variant400Url: atBucket(400),
    variant1200Url: atBucket(1200),
    variant2560Url: atBucket(2560),
    variant3840Url: atBucket(3840),
    qualityTier: qualityTier(longest),
  };

  const inserted = await recordUpload(upload, staffEmail);
  upload.id = inserted.id;
  return { ok: true, upload };
}

/** Development / persistent-disk path: sharp-rendered variants under `storage/`. */
async function storeRasterOnDisk(
  raw: Buffer,
  base: string,
  ext: string,
  lossless: boolean,
  mime: string,
  file: File,
  staffEmail: string,
): Promise<UploadResult> {
  // Re-encode rather than trusting the extension or the client's MIME type. A
  // file that is not really an image throws here, inside sharp.
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

/**
 * Remove every stored file belonging to the uploads behind these urls.
 *
 * A url may be a legacy local `/uploads/...` path (deleted from `storage/`) or a
 * Cloudinary `secure_url` (its whole variant family is deleted with one call,
 * because every size shares the one asset).
 */
export async function removeStoredFiles(urls: (string | null)[]): Promise<void> {
  const bases = new Set<string>();
  const publicIds = new Set<string>();

  for (const url of urls) {
    if (!url) continue;

    if (url.startsWith("/uploads/")) {
      // `path.basename` collapses a traversal string, so a stored url cannot
      // reach outside the upload directory.
      const name = path.basename(url);
      if (!/^[\w.-]+$/.test(name)) continue;
      bases.add(name.replace(/(-w\d+)?\.(?:webp|png|jpe?g|avif|svg)$/i, ""));
      continue;
    }

    const publicId = cloudinaryPublicIdFromUrl(url);
    if (publicId) publicIds.add(publicId);
  }

  const tasks: Promise<unknown>[] = [...bases].map((base) => removeBase(base));

  const cloud = cloudinaryConfig();
  if (cloud) {
    for (const publicId of publicIds) {
      tasks.push(destroyInCloudinary(cloud, publicId));
    }
  }

  await Promise.all(tasks);
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
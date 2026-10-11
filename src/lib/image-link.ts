/**
 * Rules for an image *link* - the primary way an admin sets a picture now.
 *
 * Storage is ephemeral on the deployment host, so the durable answer is to keep
 * the image at an outside URL (Cloudinary, a CDN, any https host) and store only
 * the string. This module is deliberately free of `node:` imports, `pg` and
 * sharp so the same checks run in the browser (live preview) and on the server
 * (before a value is written).
 *
 * Validation is intentionally permissive: any https address is accepted, because
 * an admin's photo can live on any host (WhatsApp, email attachment stores,
 * a Facebook page, a Pinterest pin…). Whether a link really displays as a
 * picture is decided by the live preview's `onerror`, and links that point at a
 * *page* (Pinterest) are rewritten to a direct image at save time by
 * `src/lib/image-resolve.ts`.
 */

/** Longest link we will store, matching the widest image column. */
export const MAX_IMAGE_URL_LENGTH = 2000;

/** The message the live preview shows when a URL did not resolve to a picture. */
export const NOT_A_DIRECT_IMAGE =
  "That link did not load a picture. It is kept as-is - check the address, or paste a direct image link (ending .jpg, .png or .webp).";

const IMAGE_EXTENSION = /\.(?:jpe?g|png|webp|gif|avif|svg|bmp|tiff?)(?:[?#].*)?$/i;

export function isExternalImageUrl(url: string | null | undefined): boolean {
  return /^https?:\/\//i.test((url ?? "").trim());
}

/**
 * Turn a Google Drive share link into a direct image address.
 *
 * `drive.google.com/file/d/<id>/view` and `open?id=` / `uc?id=` all resolve to
 * the same file id, which `lh3.googleusercontent.com/d/<id>` serves inline as an
 * image. Returns null when the input is not a Drive file link (including a Docs
 * editor link, which is not an image).
 */
export function googleDriveDirect(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.toLowerCase();
  if (host !== "drive.google.com" && host !== "docs.google.com" && host !== "drive.usercontent.google.com") {
    return null;
  }

  const fromPath = /\/file\/d\/([a-zA-Z0-9_-]{10,})/.exec(url.pathname);
  const id = fromPath?.[1] ?? url.searchParams.get("id") ?? undefined;
  if (!id || !/^[a-zA-Z0-9_-]{10,}$/.test(id)) return null;

  // `=w2400` asks Drive for a 2400px-wide render rather than the tiny default.
  return `https://lh3.googleusercontent.com/d/${id}=w2400`;
}

/** Resolve a value to what should actually be stored (Drive links are rewritten). */
export function normalizeImageUrl(raw: string | null | undefined): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  return googleDriveDirect(value) ?? value;
}

/**
 * True when the value looks like a Pinterest pin/profile URL. These are *pages*,
 * not images, so the save path rewrites them to the pin's direct image via
 * `src/lib/image-resolve.ts`. Kept here (pure, no network) so the browser
 * preview can decide when resolution is worth trying.
 */
export function isPinterestLink(raw: string | null | undefined): boolean {
  const value = (raw ?? "").trim();
  if (!value) return false;
  let host: string;
  try {
    host = new URL(value).hostname.toLowerCase();
  } catch {
    return false;
  }
  return host === "pin.it" || /(^|\.)pinterest\./i.test(host);
}

/**
 * The problem with a link, or null when it is acceptable.
 *
 * A site-relative path (`/images/...`) is allowed so existing assets keep
 * working; anything else must be an absolute https URL. No host or extension is
 * rejected - a page address is stored as-is when it cannot be resolved, and the
 * live preview confirms whether it actually renders.
 */
export function imageUrlProblem(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  if (value.length > MAX_IMAGE_URL_LENGTH) {
    return `That link is longer than ${MAX_IMAGE_URL_LENGTH} characters.`;
  }

  // Protocol-relative and backslash tricks leave the origin; refuse them.
  if (value.startsWith("//") || value.startsWith("/\\")) {
    return "Use a full https:// link for an external image.";
  }

  // A same-origin asset path is fine.
  if (value.startsWith("/")) return null;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "That does not look like a link. It should start with https://";
  }

  if (url.protocol === "http:") {
    return "Use an https:// link - http:// images are blocked on the secure site.";
  }
  if (url.protocol !== "https:") {
    return "Only https:// image links can be used.";
  }

  return null;
}

/** True when a value looks like a direct image link (used for the tick badge). */
export function looksLikeDirectImage(raw: string | null | undefined): boolean {
  const value = normalizeImageUrl(raw);
  if (!value) return false;
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    return IMAGE_EXTENSION.test(url.pathname) || url.hostname.toLowerCase().includes("googleusercontent");
  } catch {
    return false;
  }
}

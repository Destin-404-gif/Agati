/**
 * Rules for an image *link* - the primary way an admin sets a picture now.
 *
 * Storage is ephemeral on the deployment host, so the durable answer is to keep
 * the image at an outside URL (Cloudinary, a CDN, any https host) and store only
 * the string. This module is deliberately free of `node:` imports, `pg` and
 * sharp so the same checks run in the browser (live preview) and on the server
 * (before a value is written).
 */

/** Longest link we will store, matching the widest image column. */
export const MAX_IMAGE_URL_LENGTH = 2000;

/** The exact message the live preview shows when a URL does not resolve to a picture. */
export const NOT_A_DIRECT_IMAGE =
  "This link is not a direct image. Use a link ending in .jpg, .png or .webp";

const IMAGE_EXTENSION = /\.(?:jpe?g|png|webp|gif|avif|svg|bmp|tiff?)(?:[?#].*)?$/i;
const NON_IMAGE_EXTENSION =
  /\.(?:pdf|html?|zip|rar|7z|mp4|mov|avi|mkv|webm|mp3|wav|ogg|docx?|xlsx?|pptx?|txt|csv|json|xml)(?:[?#].*)?$/i;

/**
 * Hosts that serve *pages*, never a raw image. A link to one of these has to be
 * replaced by the direct image address (or a Google Drive file id, which we can
 * rewrite).
 */
const PAGE_HOSTS = new Set([
  "drive.google.com",
  "docs.google.com",
  "instagram.com",
  "www.instagram.com",
  "facebook.com",
  "www.facebook.com",
  "web.whatsapp.com",
  "wa.me",
  "api.whatsapp.com",
  "whatsapp.com",
  "www.whatsapp.com",
]);

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
 * The problem with a link, or null when it is acceptable.
 *
 * A site-relative path (`/images/...`) is allowed so existing assets keep
 * working; everything else must be an absolute https URL, must not be a page
 * host, and must not point at a file we can tell is not an image. Whether the
 * URL truly renders as an image is confirmed by the live preview (`onerror`).
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

  const host = url.hostname.toLowerCase();
  if (PAGE_HOSTS.has(host) && !googleDriveDirect(value)) {
    return "Google Drive, Instagram and WhatsApp page links are not direct images. Open the image, copy the direct image address, or use a link ending in .jpg, .png or .webp.";
  }

  if (NON_IMAGE_EXTENSION.test(url.pathname)) {
    return NOT_A_DIRECT_IMAGE;
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

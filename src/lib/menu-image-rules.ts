/**
 * The rules for a mega-menu picture, with no server-only imports.
 *
 * This module is deliberately free of any database, `node:` or sharp import so
 * the admin screen can use the same limits, messages and types as the API without
 * dragging `pg` into the browser bundle - the same split `image-variants.ts` and
 * `media-slots.ts` already make. The queries live in `menu-images.ts`, which
 * re-exports everything here for server callers.
 *
 * A menu image is an ordinary upload: `storeUpload` validated the bytes and
 * re-encoded them into the 400/1200/2560/3840 family. What is specific to a menu
 * is the shape (up to three per category, in order) and the one thing the shared
 * uploader cannot vet for us - where the picture is allowed to link to.
 */

/** The panel shows at most this many pictures per category. */
export const MENU_IMAGES_PER_CATEGORY = 3;

/**
 * Menu pictures are small panels, so they get a tighter cap than the 25MB media
 * limit. The route checks this before `storeUpload`, because that helper has its
 * own (larger) limit and would otherwise accept a file this screen rejects.
 */
export const MENU_IMAGE_MAX_BYTES = 3 * 1024 * 1024;

/** What the file input offers. Mirrors the server's magic-byte allowlist. */
export const MENU_IMAGE_TYPES = "image/png,image/jpeg,image/webp";

/** Longest caption, matching the column width. */
const CAPTION_MAX = 200;
/** Longest link, matching the column width. */
const LINK_MAX = 500;

/** What the storefront renders. One entry per picture, in display order. */
export interface MenuImage {
  id: number;
  categoryId: number;
  categorySlug: string;
  categoryName: string;
  /** Canonical (largest) url. */
  imagePath: string;
  caption: string | null;
  linkUrl: string | null;
  /** The 400/1200/2560/3840 family, ascending. */
  variants: { width: number; url: string }[];
  width: number | null;
  height: number | null;
  /** Caption when there is one, else the category name. Never empty. */
  alt: string;
}

/** A menu image with the bookkeeping the admin screen shows alongside it. */
export interface AdminMenuImage extends MenuImage {
  sortOrder: number;
  createdAt: string;
  /** The name the admin's file had, for recognition. Never used on disk. */
  originalName: string | null;
  bytes: number | null;
}

/** One category and the pictures in its panel, in display order. */
export interface AdminMenuCategory {
  id: number;
  name: string;
  slug: string;
  images: AdminMenuImage[];
}

/**
 * Reduce an admin-entered link to the two shapes that are safe to put in an
 * `href`: a site-relative path, or an absolute http(s) URL. Everything else -
 * `javascript:`, `data:`, `vbscript:`, a protocol-relative `//evil.example` -
 * becomes null and the picture falls back to its category page.
 */
export function normalizeLinkUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value || value.length > LINK_MAX) return null;

  // `//host` and `/\host` are protocol-relative: they leave the site.
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.startsWith("/")) return value;

  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** The message shown when a link cannot be used, or null when it is fine. */
export function linkUrlProblem(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  if (value.length > LINK_MAX) {
    return `That link is longer than ${LINK_MAX} characters.`;
  }
  if (normalizeLinkUrl(value) === null) {
    return "Use a link that starts with / (for example /shop/sofas) or a full https:// address.";
  }
  return null;
}

/** Trim a caption to what the column can hold. Blank becomes null. */
export function normalizeCaption(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim().slice(0, CAPTION_MAX);
  return value === "" ? null : value;
}

/** Client-side twin of the server's own checks, so a bad file never uploads. */
export function menuImageFileProblem(file: File): string | null {
  const name = file.name.toLowerCase();
  const looksRight =
    ["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    /\.(jpe?g|png|webp)$/.test(name);

  if (!looksRight) {
    return `${file.name}: only JPG, PNG or WebP images can be used here.`;
  }
  if (file.size > MENU_IMAGE_MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    return `${file.name}: that file is ${mb}MB. Menu images are limited to 3MB.`;
  }
  return null;
}
/**
 * Shared image-variant metadata.
 *
 * Plain data plus a few tiny helpers, safe to import from both the server upload
 * handler and the browser: no `node:` imports, no sharp, nothing that pulls `pg`
 * into the client bundle.
 *
 * The upload pipeline writes one file per entry in `IMAGE_VARIANT_WIDTHS`, named
 * `<base>-w<actualWidth>.<ext>`, so a variant's pixel width can always be read
 * back from its url and a correct `srcSet` built without another database read.
 */

/** Uploads up to 25MB are accepted. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** The raster types a photo slot takes. */
export const ACCEPTED_RASTER_TYPES = "image/png,image/jpeg,image/webp";
/** What a normal (non-vector) uploader accepts. */
export const ACCEPTED_IMAGE_TYPES = ACCEPTED_RASTER_TYPES;

/** The responsive widths we render, smallest first. */
export const IMAGE_VARIANT_WIDTHS = [400, 1200, 2560, 3840] as const;
export type VariantWidth = (typeof IMAGE_VARIANT_WIDTHS)[number];

/** One generated file. `width` is the actual longest edge after `inside` resize. */
export interface ImageVariant {
  width: number;
  url: string;
  bytes?: number;
}

/**
 * How sharp an upload can get on a big screen.
 *  - `4k`   - 3840px or more on the longest side.
 *  - `good` - 1920px or more.
 *  - `low`  - below 1920px; still accepted, but it may look soft when scaled up.
 */
export type QualityTier = "4k" | "good" | "low";

export function qualityTier(longestSide: number | null | undefined): QualityTier {
  const side = longestSide ?? 0;
  if (side >= 3840) return "4k";
  if (side >= 1920) return "good";
  return "low";
}

export interface QualityBadge {
  tier: QualityTier;
  label: string;
  hint: string;
}

/** The badge the admin uploader shows next to a chosen file. */
export function qualityBadge(longestSide: number | null | undefined): QualityBadge {
  const tier = qualityTier(longestSide);
  if (tier === "4k") {
    return { tier, label: "4K ready", hint: "Renders sharp on the largest screens." };
  }
  if (tier === "good") {
    return { tier, label: "Good", hint: "Sharp up to a full-HD screen." };
  }
  return {
    tier,
    label: "Low resolution",
    hint: "Low resolution, this may look blurry on large screens.",
  };
}

/** Read the pixel width back out of a `<base>-w1234.webp` style url. */
export function variantWidthFromUrl(url: string | null | undefined): number | null {
  if (!url) return null;
  const match = /-w(\d{2,5})\.(?:webp|png|jpe?g|avif)$/i.exec(url);
  return match ? Number(match[1]) : null;
}

/**
 * Build a `srcSet` from the generated variants. Duplicates (a small photo where
 * several buckets resolve to one file) are collapsed, and the list is ascending
 * so the browser's `sizes` calculation behaves.
 */
export function buildSrcSet(
  variants: readonly ImageVariant[] | null | undefined,
  fallback?: string | null,
): string | undefined {
  const byWidth = new Map<number, string>();

  for (const variant of variants ?? []) {
    const width = variant.width || variantWidthFromUrl(variant.url);
    if (!width) continue;
    if (!byWidth.has(width)) byWidth.set(width, variant.url);
  }

  if (byWidth.size === 0) {
    const width = variantWidthFromUrl(fallback);
    if (width && fallback) byWidth.set(width, fallback);
  }

  if (byWidth.size === 0) return undefined;
  return [...byWidth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([width, url]) => `${url} ${width}w`)
    .join(", ");
}

/** The largest generated variant - what a hero or a product main image wants. */
export function largestVariantUrl(
  variants: readonly ImageVariant[] | null | undefined,
  fallback?: string | null,
): string | null {
  if (!variants || variants.length === 0) return fallback ?? null;
  return [...variants].sort((a, b) => b.width - a.width)[0]!.url;
}

/**
 * Reconstruct the variant list from the four stored bucket urls. Used when a row
 * predates the pipeline (or came from the seeder) and only has whole urls.
 */
export function variantsFromUrls(
  urls: readonly (string | null | undefined)[],
): ImageVariant[] {
  const byWidth = new Map<number, string>();
  for (const url of urls) {
    const width = variantWidthFromUrl(url);
    if (url && width && !byWidth.has(width)) byWidth.set(width, url);
  }
  return [...byWidth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([width, url]) => ({ width, url }));
}
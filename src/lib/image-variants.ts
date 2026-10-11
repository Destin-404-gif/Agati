/**
 * Shared image-variant metadata.
 *
 * Plain data plus a few tiny helpers, safe to import from both the server and the
 * browser: no `node:` imports, no sharp, nothing that pulls `pg` into the client
 * bundle.
 *
 * Older rows may name one file per bucket, `<base>-w<actualWidth>.<ext>`, so a
 * variant's pixel width can always be read back from its url and a correct
 * `srcSet` built without another database read.
 */

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

/**
 * Read the pixel width back out of an upload url.
 *
 * Two shapes are understood:
 *  - a locally stored variant, named `<base>-w1234.webp`;
 *  - a Cloudinary delivery transform, e.g.
 *    `.../image/upload/w_1200,c_limit,q_90,f_auto/v1731/agati/<base>.webp`.
 *
 * Cloudinary transforms are the production shape: the master is stored once and
 * every responsive size is derived from it by URL, so no per-size file exists to
 * name. Parsing the transform keeps `buildSrcSet` and `variantsFromUrls` working
 * unchanged.
 */
export function variantWidthFromUrl(url: string | null | undefined): number | null {
  if (!url) return null;

  const named = /-w(\d{2,5})\.(?:webp|png|jpe?g|avif)$/i.exec(url);
  if (named) return Number(named[1]);

  // `upload/<transform>/v<version>/...` - pull the `w_<n>` out of the transform.
  const segment = /\/upload\/([^/]*)\/v\d+\//i.exec(url);
  if (segment) {
    const width = /(?:^|,)w_(\d{1,5})(?:,|$)/i.exec(segment[1]!);
    if (width) return Number(width[1]);
  }

  return null;
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

/**
 * Reconstruct the variant list from four stored bucket urls. Used when a row
 * predates the variant pipeline (or came from the seeder) and only has whole urls.
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

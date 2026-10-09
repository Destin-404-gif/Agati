import { query, type QueryResultRow } from "./db";
import type { MediaAsset } from "./media-slots";

/**
 * Category and subcategory pictures, read for the storefront.
 *
 * The public taxonomy itself lives in `navigation.ts` (the database has no
 * subcategory concept and its `categories` table is a coarser list), so these
 * maps are keyed by *slug* rather than by id: `categories.slug` matches the
 * navigation slug, and a subcategory is addressed as `categorySlug/subSlug`.
 * A missing row simply means "no picture yet", which every caller renders as
 * the shared neutral placeholder.
 *
 * A database outage resolves to an empty map rather than throwing, so a shop
 * page still renders its layout.
 */

export interface TaxonomyImage {
  url: string;
  alt: string;
  thumbUrl: string | null;
}

interface CategoryImageRow extends QueryResultRow {
  slug: string;
  image_url: string | null;
  image_alt: string | null;
}

interface SubcategoryImageRow extends QueryResultRow {
  category_slug: string;
  slug: string;
  image_url: string | null;
  image_alt: string | null;
}

function toAsset(
  url: string | null,
  alt: string | null,
  fallbackAlt: string,
): MediaAsset | null {
  if (!url) return null;
  return {
    url,
    thumbUrl: null,
    variant400Url: null,
    variant1200Url: null,
    variant2560Url: null,
    variant3840Url: null,
    variants: [],
    alt: alt?.trim() || fallbackAlt,
    width: null,
    height: null,
    originalWidth: null,
    originalHeight: null,
    bytes: null,
  };
}

/** Category slug -> its picture, for the home cards, menus and shop heroes. */
export async function getCategoryImageMap(): Promise<Map<string, MediaAsset>> {
  const map = new Map<string, MediaAsset>();
  try {
    const rows = await query<CategoryImageRow>(
      `SELECT slug, image_url, image_alt
         FROM categories
        WHERE image_url IS NOT NULL AND image_url <> ''`,
    );
    for (const row of rows) {
      const asset = toAsset(row.image_url, row.image_alt, `${row.slug} collection`);
      if (asset) map.set(row.slug, asset);
    }
  } catch (err) {
    console.error("[taxonomy] could not load category images", err);
  }
  return map;
}

/** `categorySlug/subSlug` -> its picture. */
export async function getSubcategoryImageMap(): Promise<Map<string, MediaAsset>> {
  const map = new Map<string, MediaAsset>();
  try {
    const rows = await query<SubcategoryImageRow>(
      `SELECT c.slug AS category_slug, s.slug, s.image_url, s.image_alt
         FROM subcategories s
         JOIN categories c ON c.id = s.category_id
        WHERE s.image_url IS NOT NULL AND s.image_url <> ''`,
    );
    for (const row of rows) {
      const asset = toAsset(row.image_url, row.image_alt, `${row.slug} collection`);
      if (asset) map.set(`${row.category_slug}/${row.slug}`, asset);
    }
  } catch (err) {
    console.error("[taxonomy] could not load subcategory images", err);
  }
  return map;
}

export function subcategoryKey(categorySlug: string, subSlug: string): string {
  return `${categorySlug}/${subSlug}`;
}

/**
 * Public pages that show a category or subcategory picture. Revalidating all of
 * them after a save means the new file is on the site immediately instead of
 * behind a cached render.
 */
export const TAXONOMY_PATHS = [
  "/",
  "/furniture",
  "/shop/[category]",
  "/shop/[category]/[subcategory]",
] as const;
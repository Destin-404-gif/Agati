import { query, type QueryResultRow } from "./db";
import { variantsFromUrls } from "./image-variants";
import {
  normalizeLinkUrl,
  type AdminMenuCategory,
  type MenuImage,
} from "./menu-image-rules";

/**
 * Pictures for the empty right-hand column of each category mega menu.
 *
 * A menu image is an ordinary upload: `storeUpload` validated the bytes, re-encoded
 * them into the 400/1200/2560/3840 family and wrote the row in `media_uploads`.
 * This module only decides which of those files a given menu should show and in
 * what order.
 *
 * A menu image is addressed by `categories.id`, because that is what the navbar
 * category bar is built from -- the "Bedroom" pill and the "Bedroom" menu are the
 * same row, so they cannot drift apart.
 *
 * No image is never an error. A category with no rows simply has no column, and
 * the panel renders the section list across the full width.
 *
 * This file is server-only: it imports `./db`. The limits, link rules, types and
 * messages live in `./menu-image-rules`, which the admin screen can import without
 * dragging `pg` into the browser bundle. They are re-exported here so route
 * handlers have one import to reach for.
 */

export * from "./menu-image-rules";

/** One row as it comes back from Postgres, before it becomes a `MenuImage`. */
interface MenuImageRow extends QueryResultRow {
  id: number;
  category_id: number;
  category_slug: string;
  category_name: string;
  image_path: string;
  caption: string | null;
  link_url: string | null;
  variant_400_url: string | null;
  variant_1200_url: string | null;
  variant_2560_url: string | null;
  variant_3840_url: string | null;
  image_width: number | null;
  image_height: number | null;
}

const SELECT_COLUMNS = `mi.id, mi.category_id, mi.image_path, mi.caption, mi.link_url,
       c.slug AS category_slug, c.name AS category_name,
       m.variant_400_url, m.variant_1200_url, m.variant_2560_url, m.variant_3840_url,
       m.width AS image_width, m.height AS image_height`;

/**
 * `media_uploads` is joined on the url rather than on an id column, so a row that
 * predates the upload pipeline - or one written by the seeder - still resolves to
 * whatever variants its filename implies.
 */
const FROM_CLAUSE = `FROM menu_images mi
       JOIN categories c ON c.id = mi.category_id
       LEFT JOIN media_uploads m ON m.url = mi.image_path`;

function toMenuImage(row: MenuImageRow): MenuImage {
  return {
    id: row.id,
    categoryId: row.category_id,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    imagePath: row.image_path,
    caption: row.caption,
    // Only ever rendered after passing through normalizeLinkUrl. The column is
    // TEXT and can be edited by hand, so it is re-checked here too - a
    // `javascript:` href must never reach the storefront.
    linkUrl: normalizeLinkUrl(row.link_url),
    variants: variantsFromUrls([
      row.variant_400_url,
      row.variant_1200_url,
      row.variant_2560_url,
      row.variant_3840_url,
      row.image_path,
    ]),
    width: row.image_width,
    height: row.image_height,
    alt: row.caption?.trim() || `${row.category_name} collection`,
  };
}

/**
 * Every menu image for the active categories, in display order.
 *
 * A database outage resolves to an empty list rather than throwing, so the
 * mega menu still opens with no pictures in it.
 */
export async function getMenuImages(): Promise<MenuImage[]> {
  try {
    const rows = await query<MenuImageRow>(
      `SELECT ${SELECT_COLUMNS} ${FROM_CLAUSE}
        WHERE c.is_active = TRUE
        ORDER BY c.sort_order, c.id, mi.sort_order, mi.id`,
    );
    return rows.map(toMenuImage);
  } catch (err) {
    console.error("[menu-images] could not load menu images", err);
    return [];
  }
}

/** One active category, for validating an upload's `category_id`. */
export async function findMenuCategory(id: number): Promise<{
  id: number;
  name: string;
  slug: string;
} | null> {
  const rows = await query<{ id: number; name: string; slug: string }>(
    `SELECT id, name, slug FROM categories WHERE id = $1 AND is_active = TRUE`,
    [id],
  );
  return rows[0] ?? null;
}

/** How many pictures a category already has - the 3-slot cap. */
export async function countMenuImages(categoryId: number): Promise<number> {
  const rows = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM menu_images WHERE category_id = $1`,
    [categoryId],
  );
  return rows[0]?.count ?? 0;
}

/** A new picture goes to the end of its category's row. */
export async function nextMenuImageSortOrder(categoryId: number): Promise<number> {
  return countMenuImages(categoryId);
}

/* --------------------------------------------------------------- admin board */

interface AdminMenuImageRow extends MenuImageRow {
  sort_order: number;
  created_at: string;
  original_name: string | null;
  bytes: number | null;
}

/**
 * Every active category, each with its pictures - including the categories that
 * have none, because those are the ones the admin needs to be able to add to.
 * `LEFT JOIN` throughout, so a category is never missing from the board.
 */
export async function getMenuImageBoard(): Promise<AdminMenuCategory[]> {
  const rows = await query<AdminMenuImageRow>(
    `SELECT c.id AS category_id,
            mi.id, mi.image_path, mi.caption, mi.link_url,
            mi.sort_order, mi.created_at,
            c.slug AS category_slug, c.name AS category_name,
            m.variant_400_url, m.variant_1200_url, m.variant_2560_url, m.variant_3840_url,
            m.width AS image_width, m.height AS image_height,
            m.original_name, m.bytes
       FROM categories c
       LEFT JOIN menu_images mi ON mi.category_id = c.id
       LEFT JOIN media_uploads m ON m.url = mi.image_path
      WHERE c.is_active = TRUE
      ORDER BY c.sort_order, c.id, mi.sort_order, mi.id`,
  );

  const board: AdminMenuCategory[] = [];
  const byCategory = new Map<number, AdminMenuCategory>();

  for (const row of rows) {
    let category = byCategory.get(row.category_id);
    if (!category) {
      category = { id: row.category_id, name: row.category_name, slug: row.category_slug, images: [] };
      byCategory.set(row.category_id, category);
      board.push(category);
    }
    // `id` is null on the category row that the LEFT JOIN invented.
    if (row.id === null) continue;

    category.images.push({
      ...toMenuImage(row),
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      originalName: row.original_name,
      bytes: row.bytes,
    });
  }

  return board;
}
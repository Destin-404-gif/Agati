import type { PoolClient } from "pg";
import { getPool, query } from "@/lib/db";

export interface ProductPlacementInput {
  navbar: "top_bar" | "category_bar";
  navItemId: number;
  megaSectionId: number | null;
}

export async function validateProductCategory(
  categoryId: number,
  subcategoryId: number | null,
): Promise<string | null> {
  const rows = await query<{ category_id: number; subcategory_id: number | null }>(
    `SELECT c.id AS category_id, s.id AS subcategory_id
       FROM categories c
       LEFT JOIN subcategories s ON s.id = $2 AND s.category_id = c.id
      WHERE c.id = $1 AND c.is_active = TRUE`,
    [categoryId, subcategoryId],
  );
  if (!rows.length) return "Choose an active category.";
  if (subcategoryId != null && rows[0].subcategory_id !== subcategoryId) {
    return "Choose a subcategory belonging to the selected category.";
  }
  return null;
}

/** Helpers shared by the product route and the product [id] route. */

export async function slugIsTaken(
  slug: string,
  excludeId?: number,
): Promise<boolean> {
  const rows = await query<{ id: number }>(
    "SELECT id FROM products WHERE slug = $1 AND ($2::int IS NULL OR id <> $2)",
    [slug, excludeId ?? null],
  );
  return rows.length > 0;
}

/** Appends -2, -3 … until the slug is free. */
export async function uniqueSlug(
  base: string,
  excludeId?: number,
): Promise<string> {
  let candidate = base;
  let n = 1;
  while (await slugIsTaken(candidate, excludeId)) {
    n += 1;
    candidate = `${base}-${n}`;
  }
  return candidate;
}

export async function validateProductPlacements(
  placements: ProductPlacementInput[],
): Promise<string | null> {
  const itemIds = [...new Set(placements.map((placement) => placement.navItemId))];
  const rows = await query<{
    id: number;
    navbar: ProductPlacementInput["navbar"];
    has_mega_menu: boolean;
    section_ids: number[];
  }>(
    `SELECT n.id, n.navbar, n.has_mega_menu,
            COALESCE(array_agg(s.id) FILTER (WHERE s.id IS NOT NULL), ARRAY[]::int[]) AS section_ids
       FROM nav_items n
       LEFT JOIN mega_menu_sections s ON s.nav_item_id = n.id
      WHERE n.id = ANY($1::int[])
      GROUP BY n.id`,
    [itemIds],
  );
  const items = new Map(rows.map((row) => [row.id, row]));
  const seen = new Set<string>();

  for (const placement of placements) {
    const item = items.get(placement.navItemId);
    if (!item || item.navbar !== placement.navbar) return "Choose a menu item from the selected navbar.";
    if (item.has_mega_menu && placement.megaSectionId == null) return "Choose a mega-menu section for this item.";
    if (!item.has_mega_menu && placement.megaSectionId != null) return "This menu item has no mega-menu.";
    if (placement.megaSectionId != null && !item.section_ids.includes(placement.megaSectionId)) {
      return "Choose a section belonging to the selected menu item.";
    }
    const key = `${placement.navItemId}:${placement.megaSectionId ?? "none"}`;
    if (seen.has(key)) return "Remove duplicate product placements.";
    seen.add(key);
  }
  return null;
}

export async function replaceProductPlacements(
  client: PoolClient,
  productId: number,
  placements: ProductPlacementInput[],
): Promise<void> {
  await client.query("DELETE FROM product_placements WHERE product_id = $1", [productId]);
  for (const placement of placements) {
    await client.query(
      `INSERT INTO product_placements (product_id, nav_item_id, mega_section_id)
       VALUES ($1,$2,$3)`,
      [productId, placement.navItemId, placement.megaSectionId],
    );
  }
  const primary = placements[0];
  await client.query(
    `UPDATE products SET navbar = $1, nav_item_id = $2, mega_section_id = $3 WHERE id = $4`,
    [primary?.navbar ?? null, primary?.navItemId ?? null, primary?.megaSectionId ?? null, productId],
  );
}

export async function getProductTaxonomy(
  categoryId: number | null,
  subcategoryId: number | null,
): Promise<{ category_slug: string; subcategory_slug: string | null } | null> {
  if (!categoryId) return null;
  const rows = await query<{ category_slug: string; subcategory_slug: string | null }>(
    `SELECT c.slug AS category_slug, s.slug AS subcategory_slug
       FROM categories c
       LEFT JOIN subcategories s ON s.id = $2 AND s.category_id = c.id
      WHERE c.id = $1`,
    [categoryId, subcategoryId],
  );
  if (!rows[0] || (subcategoryId && !rows[0].subcategory_slug)) return null;
  return rows[0];
}

/**
 * Replaces a product's image list. The first entry becomes the primary image the
 * storefront shows, so ordering matters.
 */
export async function replaceProductImages(
  client: PoolClient,
  productId: number,
  images: { url: string }[],
): Promise<void> {
  await client.query("DELETE FROM product_images WHERE product_id = $1", [
    productId,
  ]);

  for (const [position, image] of images.entries()) {
    if (!image.url) continue;
    await client.query(
      "INSERT INTO product_images (product_id, image_url, position) VALUES ($1,$2,$3)",
      [productId, image.url, position],
    );
  }
}

/** Runs `fn` in a transaction with the image list already written. */
export async function withProductImages<T>(
  fn: (client: PoolClient) => Promise<T>,
  images: { url: string }[],
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    if (images.length > 0 && "id" in (result as object)) {
      await replaceProductImages(
        client,
        (result as { id: number }).id,
        images,
      );
    }
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

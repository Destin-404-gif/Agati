import { revalidatePath } from "next/cache";

/**
 * Cache invalidation for content the admin edits.
 *
 * The storefront pages are `force-dynamic`, but Next still caches the rendered
 * output of dynamic routes per-request-segment, and the client cache holds the
 * previous tree. Revalidating the affected paths from the route handler means an
 * admin's upload is on the public site on the next visit rather than after a
 * deploy. Safe to call repeatedly.
 */

const TAXONOMY_PAGES = [
  "/",
  "/furniture",
  // The category tree the imagery manager edits. The hero card is rendered by
  // both of these, and `/category/...` is the route visitors actually land on.
  "/category/[slug]",
  "/category/[slug]/[subcategory]",
  "/shop/[category]",
  "/shop/[category]/[subcategory]",
] as const;

/** Call after a category or subcategory is added, renamed, reordered or deleted. */
export function revalidateTaxonomy(): void {
  for (const path of TAXONOMY_PAGES) {
    revalidatePath(path, "page");
  }
  // The navbar and mega menu read the taxonomy, so the site layout has to go too.
  revalidatePath("/", "layout");
}

/** Call after a gallery item is added, edited, reordered or deleted. */
export function revalidateGallery(): void {
  revalidatePath("/gallery");
}

export function revalidateProductTaxonomy(
  taxonomies: ({ category_slug: string; subcategory_slug: string | null } | null)[],
): void {
  const paths = new Set<string>();
  for (const taxonomy of taxonomies) {
    if (!taxonomy) continue;
    paths.add(`/shop/${taxonomy.category_slug}`);
    if (taxonomy.subcategory_slug) {
      paths.add(`/shop/${taxonomy.category_slug}/${taxonomy.subcategory_slug}`);
    }
  }
  for (const path of paths) revalidatePath(path);
}

export function revalidateNavigation(): void {
  revalidatePath("/api/navigation");
  revalidatePath("/", "layout");
}

/**
 * Call after a menu image is uploaded, edited, reordered or deleted.
 *
 * The mega menu fetches its pictures from `/api/menu-images` on the client, so
 * that endpoint is the one that must not be served from cache; the site layout is
 * invalidated too because the navbar is part of it.
 */
export function revalidateMenuImages(): void {
  revalidatePath("/api/menu-images");
  revalidatePath("/", "layout");
}
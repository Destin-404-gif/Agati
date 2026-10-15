import type { MetadataRoute } from "next";
import { getNavigationData } from "@/lib/navigation-data";
import { getCategories, getProducts, getSubcategories } from "@/lib/queries";
import { SITE } from "@/lib/siteConfig";
import type { Product } from "@/lib/types";

/**
 * Generated sitemap.
 *
 * `force-dynamic` keeps it out of the build: the product and category URLs come
 * from the database, which is not necessarily reachable when the image is
 * built. Every database read is guarded, so a cold or unreachable database
 * degrades to just the static pages rather than a 500.
 */
export const dynamic = "force-dynamic";

/**
 * Public, indexable, crawlable pages every deploy has. The homepage is the
 * empty path; the rest are the top-level routes in `(site)`.
 */
const STATIC_PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "", priority: 1, changeFrequency: "weekly" },
  { path: "/furniture", priority: 0.9, changeFrequency: "daily" },
  { path: "/custom-furniture", priority: 0.8, changeFrequency: "monthly" },
  { path: "/services", priority: 0.7, changeFrequency: "monthly" },
  { path: "/projects", priority: 0.7, changeFrequency: "monthly" },
  { path: "/gallery", priority: 0.6, changeFrequency: "monthly" },
  { path: "/about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.7, changeFrequency: "monthly" },
  { path: "/team", priority: 0.5, changeFrequency: "monthly" },
];

/**
 * First path segments that already have a dedicated page. A top-bar nav item
 * whose slug lands here is the same URL as the static page above and must not
 * be emitted twice.
 */
const RESERVED_SEGMENTS = new Set([
  ...STATIC_PAGES.map((page) => page.path.replace(/^\//, "")).filter(Boolean),
  "category",
  "shop",
  "search",
  "cart",
  "checkout",
  "order",
  "admin",
  "api",
]);

async function productEntries(): Promise<MetadataRoute.Sitemap> {
  const products: Product[] = [];
  for (let offset = 0; ; offset += 100) {
    const { products: page, total } = await getProducts({ limit: 100, offset });
    products.push(...page);
    if (page.length === 0 || products.length >= total) break;
  }
  return products.map((product) => ({
    url: `${SITE.url}/furniture/${product.slug}`,
    lastModified: product.created_at,
    changeFrequency: "weekly",
    priority: 0.8,
  }));
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = STATIC_PAGES.map((page) => ({
    url: `${SITE.url}${page.path}`,
    changeFrequency: page.changeFrequency,
    priority: page.priority,
  }));

  try {
    const navigation = await getNavigationData();
    for (const item of navigation.top_bar) {
      if (RESERVED_SEGMENTS.has(item.slug)) continue;
      entries.push({ url: `${SITE.url}/${item.slug}`, changeFrequency: "weekly", priority: 0.6 });
      // Section pages (`/{item}/{section}`) are canonical for top-bar items and
      // are reached through the mega menu, so list them for direct discovery.
      for (const section of item.sections) {
        if (!section.slug) continue;
        entries.push({ url: `${SITE.url}/${item.slug}/${section.slug}`, changeFrequency: "weekly", priority: 0.4 });
      }
    }
  } catch (error) {
    console.error("[sitemap] navigation unavailable", error);
  }

  try {
    const categories = await getCategories();
    for (const category of categories) {
      entries.push({ url: `${SITE.url}/category/${category.slug}`, priority: 0.7 });
    }
  } catch (error) {
    console.error("[sitemap] categories unavailable", error);
  }

  try {
    const subcategories = await getSubcategories();
    for (const subcategory of subcategories) {
      entries.push({
        url: `${SITE.url}/category/${subcategory.category_slug}/${subcategory.slug}`,
        priority: 0.5,
      });
    }
  } catch (error) {
    console.error("[sitemap] subcategories unavailable", error);
  }

  try {
    entries.push(...(await productEntries()));
  } catch (error) {
    console.error("[sitemap] products unavailable", error);
  }

  return entries;
}

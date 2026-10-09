import CategoryGrid from "@/components/CategoryGrid";
import FeaturedCollection from "@/components/FeaturedCollection";
import Hero from "@/components/Hero";
import IntroSection from "@/components/IntroSection";
import { getMedia, heroSlideSlot, HERO_SLIDE_COUNT } from "@/lib/media";
import { getCategories, getProducts } from "@/lib/queries";
import type { Category, Product } from "@/lib/types";

// Storefront content changes rarely and must always be fresh.
export const dynamic = "force-dynamic";

async function loadHomepageData() {
  try {
    const [categories, featured, media] = await Promise.all([
      getCategories(),
      getProducts({ featured: true, limit: 6 }),
      getMedia([
        ...Array.from({ length: HERO_SLIDE_COUNT }, (_, i) => heroSlideSlot(i)),
        "intro_workshop",
        "featured_collection",
      ]),
    ]);
    return { categories, products: featured.products, media, dbError: null as string | null };
  } catch (err) {
    console.error("[home] database unavailable, rendering empty shell", err);
    return {
      categories: [] as Category[],
      products: [] as Product[],
      media: {} as Record<string, never>,
      dbError: "Database unavailable",
    };
  }
}

export default async function Home() {
  const { categories, products, media, dbError } = await loadHomepageData();

  return (
    <main>
      {dbError && (
        <div className="fixed inset-x-0 top-24 z-40 px-5">
          <p className="mx-auto max-w-3xl rounded-full bg-terracotta px-6 py-3 text-center text-xs font-semibold uppercase tracking-[0.14em] text-cream shadow-lift">
            {dbError} - set DATABASE_URL and run db/schema.sql + db/seed.sql
          </p>
        </div>
      )}

      <Hero
        featured={products}
        slides={Array.from({ length: HERO_SLIDE_COUNT }, (_, i) => media[heroSlideSlot(i)] ?? null)}
      />
      <IntroSection image={media.intro_workshop ?? null} />
      <CategoryGrid categories={categories} />
      <FeaturedCollection products={products} image={media.featured_collection ?? null} />
    </main>
  );
}
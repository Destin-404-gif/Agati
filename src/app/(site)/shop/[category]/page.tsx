import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import MediaImage from "@/components/MediaImage";
import PageHero from "@/components/PageHero";
import ProductCard from "@/components/ProductCard";
import { Reveal, RevealItem } from "@/components/Reveal";
import { categoryItems, findCategory, subcategoryHref } from "@/lib/navigation";
import { gallerySlot, getMedia, GALLERY_COUNT, type MediaAsset } from "@/lib/media";
import { getProducts, getSubcategories } from "@/lib/queries";
import { categoryMatches, subcategoryMatches } from "@/lib/search";

type Props = {
  params: Promise<{ category: string }>;
};

export async function generateStaticParams() {
  const { CATEGORIES } = await import("@/lib/navigation");
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const entry = findCategory(category);
  if (!entry) return { title: "Shop" };
  return {
    title: `${entry.name} - Shop`,
    description: `Browse ${entry.name}, bench-made to order at the Agati Wood Works workshop.`,
  };
}

export default async function ShopCategoryPage({ params }: Props) {
  const { category: slug } = await params;
  const category = findCategory(slug);
  if (!category) notFound();

  const totalKinds = categoryItems(category).length;
  const galleryKeys = Array.from({ length: GALLERY_COUNT }, (_, i) => gallerySlot(i));

  const [{ products }, media, subcategories] = await Promise.all([
    getProducts({ limit: 100 }),
    getMedia(galleryKeys),
    getSubcategories(),
  ]);
  const matched = products.filter((p) => categoryMatches(p.name, category.slug));

  // Subcategory tiles walk the gallery slots in order, wrapping if a category
  // has more tiles than there are slots - the same behaviour the old hardcoded
  // array had.
  const tileImage = (index: number): MediaAsset | null =>
    media[gallerySlot(index % GALLERY_COUNT)] ?? null;

  return (
    <>
      <PageHero
        eyebrow="Shop the range"
        title={`${category.name}\ncollection`}
        intro={`${category.name} furniture, bench-made from solid timber in Bloomington. ${totalKinds} ways to start, every one built to order.`}
        illustrationSlug={category.slug}
        crumbs={[
          { label: "Catalogue", href: "/furniture" },
          { label: category.name },
        ]}
      />

      <section className="mx-auto max-w-[1600px] px-5 py-16 sm:px-8 sm:py-20">
        <RevealItem>
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-terracotta/10 text-terracotta">
                <category.icon className="size-6" aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-2xl font-black uppercase tracking-[-0.02em] text-espresso sm:text-3xl">
                  Explore {category.name}
                </h2>
                <p className="mt-1 text-xs text-espresso/50">{category.blurb}</p>
              </div>
            </div>
            <span className="shrink-0 text-xs text-espresso/45">{totalKinds} collections</span>
          </div>
        </RevealItem>

        <div className="mt-10 space-y-12">
          {category.groups.map((group, gi) => (
            <div key={group.title}>
              <RevealItem>
                <div className="flex items-center gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-espresso/50">
                    {group.title}
                  </p>
                  <span className="h-px flex-1 bg-espresso/10" aria-hidden="true" />
                </div>
              </RevealItem>

              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {group.items.map((item, i) => {
                  const count = products.filter((p) =>
                    (p.subcategory_id != null && subcategories.some(
                      (subcategory) =>
                        subcategory.id === p.subcategory_id &&
                        subcategory.category_slug === category.slug &&
                        subcategory.slug === item.slug,
                    )) ||
                    (p.subcategory_id == null && subcategoryMatches(p.name, category.slug, item.slug)),
                  ).length;
                  return (
                    <Link
                      key={`${gi}-${item.slug}`}
                      href={subcategoryHref(category.slug, item.slug)}
                      className="group flex flex-col overflow-hidden rounded-[2rem] border border-espresso/10 bg-white shadow-soft transition-all duration-500 hover:-translate-y-1 hover:shadow-lift"
                    >
                      <div className="relative aspect-[4/5] overflow-hidden">
                        <MediaImage
                          asset={tileImage(gi * 4 + i)}
                          alt=""
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 20vw"
                          placeholderLabel={item.name}
                          className="object-cover transition-transform duration-[900ms] ease-out group-hover:scale-110"
                        />
                        {count > 0 && (
                          <span className="absolute left-3 top-3 rounded-full bg-espresso/85 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-cream backdrop-blur-sm">
                            {count} {count === 1 ? "piece" : "pieces"}
                          </span>
                        )}
                        <span className="absolute bottom-3 left-3 flex size-9 items-center justify-center rounded-lg bg-cream/90 text-espresso shadow-soft backdrop-blur-sm transition-colors duration-300 group-hover:bg-terracotta group-hover:text-cream">
                          <item.icon className="size-4" aria-hidden="true" />
                        </span>
                      </div>
                      <div className="flex items-center justify-between px-5 py-4">
                        <div>
                          <p className="text-[15px] font-semibold uppercase tracking-[0.06em] text-espresso">
                            {item.name}
                          </p>
                          <p className="mt-0.5 text-[11px] text-espresso/45">
                            {count > 0 ? "Ready to order" : "Made to order"}
                          </p>
                        </div>
                        <ArrowRight
                          className="size-4 shrink-0 text-espresso/40 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-terracotta"
                          aria-hidden="true"
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}

          <Link
            href="/custom-furniture"
            className="group flex flex-col justify-between overflow-hidden rounded-[2rem] border-2 border-dashed border-espresso/20 bg-cream/50 p-6 transition-colors duration-500 hover:border-terracotta"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-terracotta">Custom</p>
              <p className="mt-2 font-display text-xl font-black uppercase leading-snug tracking-[-0.02em] text-espresso">
                Need a one-off? The workshop builds it.
              </p>
            </div>
            <span className="mt-8 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso transition-colors group-hover:text-terracotta">
              Start a custom project <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        </div>
      </section>

      {matched.length > 0 && (
        <section className="mx-auto max-w-[1600px] px-5 pb-16 sm:px-8 sm:pb-24">
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-eyebrow text-terracotta">In stock trends</p>
                <h2 className="mt-3 font-display text-2xl font-black uppercase tracking-[-0.02em] text-espresso sm:text-3xl">
                  {matched.length} {matched.length === 1 ? "matching piece" : "matching pieces"}
                </h2>
              </div>
              <Link
                href={`/search?q=${encodeURIComponent(category.name)}`}
                className="hidden shrink-0 rounded-full border border-espresso/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso transition-colors hover:border-espresso sm:inline-flex"
              >
                Search {category.name}
              </Link>
            </div>
          </Reveal>
          <div className="mt-8 grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {matched.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
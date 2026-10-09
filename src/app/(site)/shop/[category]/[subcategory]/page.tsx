import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageSearch } from "lucide-react";
import PageHero from "@/components/PageHero";
import ProductCard from "@/components/ProductCard";
import { Reveal, RevealItem } from "@/components/Reveal";
import {
  categoryHref,
  categoryItems,
  findCategory,
  findSubcategory,
  subcategoryHref,
} from "@/lib/navigation";
import { getProducts, getSubcategories } from "@/lib/queries";
import { subcategoryMatches } from "@/lib/search";

type Props = {
  params: Promise<{ category: string; subcategory: string }>;
};

export async function generateStaticParams() {
  const { CATEGORIES, categoryItems } = await import("@/lib/navigation");
  return CATEGORIES.flatMap((c) =>
    categoryItems(c).map((item) => ({ category: c.slug, subcategory: item.slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, subcategory } = await params;
  const entry = findSubcategory(category, subcategory);
  if (!entry) return { title: "Shop" };
  return {
    title: `${entry.name} - Shop`,
    description: `${entry.name}, part of the ${category} collection at Agati Wood Works. Bench-made to order.`,
  };
}

export default async function ShopSubcategoryPage({ params }: Props) {
  const { category: categorySlug, subcategory: subSlug } = await params;
  const category = findCategory(categorySlug);
  const sub = findSubcategory(categorySlug, subSlug);
  if (!category || !sub) notFound();

  const [{ products }, subcategories] = await Promise.all([
    getProducts({ limit: 100 }),
    getSubcategories(),
  ]);
  const subcategoryId = subcategories.find(
    (item) => item.category_slug === categorySlug && item.slug === subSlug,
  )?.id;
  const matched = products.filter((p) =>
    (subcategoryId != null && p.subcategory_id === subcategoryId) ||
    (p.subcategory_id == null && subcategoryMatches(p.name, categorySlug, subSlug)),
  );
  const siblings = categoryItems(category).filter((i) => i.slug !== subSlug);

  return (
    <>
      <PageHero
        eyebrow={`${category.name} collection`}
        title={sub.name}
        intro={
          matched.length > 0
            ? `${matched.length} ${matched.length === 1 ? "piece" : "pieces"} bench-made for this collection.`
            : "Every piece is built to order in solid timber - tell the workshop what you need."
        }
        illustrationSlug={sub.slug}
        illustrationParentSlug={category.slug}
        crumbs={[
          { label: "Catalogue", href: "/furniture" },
          { label: category.name, href: categoryHref(categorySlug) },
          { label: sub.name },
        ]}
      />

      <section className="mx-auto max-w-[1600px] px-5 py-16 sm:px-8 sm:py-20">
        {siblings.length > 0 && (
          <Reveal className="mb-12">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-espresso/40">
              More in {category.name}
            </p>
            <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
              {siblings.map((item) => (
                <Link
                  key={item.slug}
                  href={subcategoryHref(category.slug, item.slug)}
                  className="shrink-0 rounded-full border border-espresso/15 bg-white px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-espresso/60 transition-colors hover:border-terracotta hover:text-terracotta"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <item.icon className="size-3.5 shrink-0" aria-hidden="true" />
                    {item.name}
                  </span>
                </Link>
              ))}
            </div>
          </Reveal>
        )}

        {matched.length > 0 ? (
          <Reveal>
            <div className="flex items-end justify-between gap-4">
              <h2 className="font-display text-2xl font-black uppercase tracking-[-0.02em] text-espresso sm:text-3xl">
                {matched.length} {matched.length === 1 ? "piece" : "pieces"}
              </h2>
            </div>
          </Reveal>
        ) : null}

        {matched.length > 0 ? (
          <div className="mt-8 grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {matched.map((product, i) => (
              <ProductCard key={product.id} product={product} index={i} />
            ))}
          </div>
        ) : (
          <Reveal className="rounded-[2rem] border border-espresso/10 bg-white p-10 text-center sm:p-14">
            <RevealItem>
              <PackageSearch className="mx-auto size-10 text-terracotta" aria-hidden="true" />
              <h2 className="mt-5 font-display text-2xl font-black uppercase tracking-[-0.02em] text-espresso">
                {sub.name} is made to order
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-espresso/60">
                The catalogue currently carries a hand-picked range, but every
                collection is built to order in solid timber. Describe the piece,
                and the workshop will quote it.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Link
                  href="/contact#quote"
                  className="rounded-full bg-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-terracotta"
                >
                  Request a quote
                </Link>
                <Link
                  href="/custom-furniture"
                  className="rounded-full border border-espresso/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso transition-colors hover:border-espresso"
                >
                  Custom furniture
                </Link>
              </div>
            </RevealItem>
          </Reveal>
        )}
      </section>
    </>
  );
}
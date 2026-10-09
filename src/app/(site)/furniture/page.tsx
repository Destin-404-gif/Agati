import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import PageHero from "@/components/PageHero";
import ProductCard from "@/components/ProductCard";
import { Reveal as RevealBox, RevealItem } from "@/components/Reveal";
import SortSelect from "@/components/SortSelect";
import { boolParam } from "@/lib/api";
import { getMedia, pageHeroSlot, type MediaAsset } from "@/lib/media";
import { getCategories, getProducts } from "@/lib/queries";
import type { Category, Product } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Furniture",
  description:
    "Solid hardwood armchairs, dining chairs and sofas - hand-cut joinery, hardwax oil finishes, made in Musanze, Rwanda. Made-to-measure pieces quoted per commission.",
};

const HERO_KEY = pageHeroSlot("furniture");

export default async function FurniturePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const category = sp.category ?? "";
  const q = sp.q ?? "";
  const sort = sp.sort ?? "newest";

  let categories: Category[] = [];
  let products: Product[] = [];
  let total = 0;
  let banner: MediaAsset | null = null;
  let dbError: string | null = null;

  try {
    const [cats, result, media] = await Promise.all([
      getCategories(),
      getProducts({
        category: category || undefined,
        search: q || undefined,
        sort,
        isNew: boolParam(sp.new ?? null),
        limit: 60,
      }),
      getMedia([HERO_KEY]),
    ]);
    categories = cats;
    products = result.products;
    total = result.total;
    banner = media[HERO_KEY] ?? null;
  } catch (err) {
    console.error("[furniture] database unavailable", err);
    dbError = "Catalogue unavailable - is the database running?";
  }

  const activeLabel =
    categories.find((c) => c.slug === category)?.name ?? (q ? `“${q}”` : null);

  return (
    <main>
      <PageHero
        eyebrow="The catalogue"
        title={"Every piece is\ncut to order"}
        intro="Nothing sits in a warehouse. Each item is cut once, for your room, from timber we have dried and graded ourselves."
        image={banner}
        crumbs={[{ label: "Home", href: "/" }, { label: "Furniture" }]}
      />

      <section className="bg-cream py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-[1600px] px-5 sm:px-8">
          {/* ------------------------------------------------- filter bar */}
          <div className="flex flex-col gap-6 border-b border-espresso/10 pb-8 lg:flex-row lg:items-center lg:justify-between">
            <nav aria-label="Filter by category" className="flex flex-wrap gap-2">
              <FilterPill href="/furniture" active={!category && !q} label="All" count={null} />
              {categories.map((c) => (
                <FilterPill
                  key={c.id}
                  href={`/furniture?category=${c.slug}`}
                  active={category === c.slug}
                  label={c.name}
                  count={c.product_count}
                />
              ))}
            </nav>

            <Suspense
              fallback={<div className="h-11 w-48 rounded-full bg-espresso/5" aria-hidden="true" />}
            >
              <SortSelect />
            </Suspense>
          </div>

          {/* ------------------------------------------------ result count */}
          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-display text-[clamp(1.75rem,3.5vw,2.5rem)] text-espresso">
              {activeLabel ?? "All pieces"}
            </h2>
            <p className="text-xs uppercase tracking-[0.16em] text-espresso/40">
              {total} {total === 1 ? "piece" : "pieces"}
            </p>
          </div>

          {q && (
            <p className="mt-3 text-sm text-espresso/55">
              Showing results for <span className="font-semibold text-espresso">“{q}”</span>{" "}
              <Link
                href="/furniture"
                className="ml-1 text-terracotta underline underline-offset-4 hover:text-espresso"
              >
                Clear
              </Link>
            </p>
          )}

          {dbError ? (
            <div className="mt-10 rounded-[2.5rem] bg-terracotta/10 p-10 text-center">
              <p className="text-display text-xl text-espresso">{dbError}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="mt-10 rounded-[2.5rem] border border-dashed border-espresso/20 p-12 text-center">
              <p className="text-display text-2xl text-espresso/70">Nothing matches that</p>
              <p className="mx-auto mt-3 max-w-sm text-sm text-espresso/50">
                {q
                  ? `No pieces mention “${q}”. Try a timber name like oak, walnut or cherry.`
                  : "No pieces in this category yet."}
              </p>
              <Link
                href="/furniture"
                className="mt-7 inline-flex rounded-full bg-espresso px-6 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-terracotta"
              >
                See everything
              </Link>
            </div>
          ) : (
            <RevealBox stagger={0.07} className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
              {products.map((product, i) => (
                <RevealItem key={product.id}>
                  <ProductCard product={product} index={i} />
                </RevealItem>
              ))}
            </RevealBox>
          )}

          {/* ----------------------------------------------- timber note */}
          <div className="mt-20 grid gap-5 rounded-[2.5rem] bg-espresso p-8 text-cream sm:p-12 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <p className="text-eyebrow text-terracotta">Timber</p>
              <h2 className="mt-5 text-display text-[clamp(1.75rem,3.5vw,2.75rem)] text-cream">
                Want a species we haven&rsquo;t listed?
              </h2>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-cream/65">
                We keep 14 hardwoods in the racks. If you want elm, sycamore or
                something with real figure, say so - we will find it and tell you
                honestly how it will age.
              </p>
            </div>
            <Link
              href="/contact#quote"
              className="inline-flex justify-self-start rounded-full bg-cream px-8 py-4 text-[12px] font-semibold uppercase tracking-[0.14em] text-espresso transition-all duration-300 hover:scale-[1.04] hover:bg-terracotta hover:text-cream"
            >
              Request a species
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function FilterPill({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number | null;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={[
        "rounded-full px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] transition-all duration-300",
        active
          ? "bg-espresso text-cream"
          : "bg-white text-espresso/65 shadow-soft hover:bg-espresso/5 hover:text-espresso",
      ].join(" ")}
    >
      {label}
      {typeof count === "number" && (
        <span className={active ? "ml-2 text-cream/50" : "ml-2 text-espresso/35"}>{count}</span>
      )}
    </Link>
  );
}

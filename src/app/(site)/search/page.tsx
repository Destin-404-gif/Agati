import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, PackageSearch } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { Reveal, RevealItem } from "@/components/Reveal";
import {
  CATEGORIES,
  categoryHref,
  categoryIcon,
  findCategory,
  subcategoryNames,
} from "@/lib/navigation";
import {
  normaliseTerm,
  isSearchable,
  
  search,
  RESULTS_PER_PAGE,
  type SearchSort,
} from "@/lib/search";
import SearchSortInput from "./SearchSortWrapper";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    sort?: string;
    page?: string;
  }>;
};

const qs = (params: { q: string; category?: string; sort?: string; page?: number }) => {
  const next = new URLSearchParams();
  next.set("q", params.q);
  if (params.category) next.set("category", params.category);
  if (params.sort) next.set("sort", params.sort);
  if (params.page && params.page > 1) next.set("page", String(params.page));
  return next.toString();
};

export async function generateMetadata({ searchParams }: SearchPageProps): Promise<Metadata> {
  const sp = await searchParams;
  const term = normaliseTerm(sp.q);
  return {
    title: term ? `Search: ${term}` : "Search the catalogue",
    description: term
      ? `Search results for “${term}” across the Agati Wood Works catalogue.`
      : "Find the right piece - search the Agati Wood Works catalogue.",
  };
}

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const sp = await searchParams;
  const term = normaliseTerm(sp.q);
  const category = sp.category && findCategory(sp.category) ? sp.category : undefined;
  const rawSort = sp.sort as any;
  const sort: SearchSort = isSearchSort(rawSort) ? rawSort : "relevance";
  const page = Math.max(1, Math.floor(Number(sp.page) || 1));

  const valid = isSearchable(term);
  const offset = (page - 1) * RESULTS_PER_PAGE;
  const result = valid
    ? await search({ term, category, sort, limit: RESULTS_PER_PAGE, offset })
    : null;

  const total = result?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / RESULTS_PER_PAGE));
  const products = result?.products ?? [];
  const categories = result?.categories ?? [];
  const activeCategory = category ? findCategory(category) : undefined;

  const sortLabel = sort === "relevance" ? "relevance" : sort.replace("_", " · ");

  return (
    <>
      <section className="relative overflow-hidden bg-sage">
        <div className="mx-auto max-w-[1600px] px-5 pb-16 pt-[var(--header-h)] sm:px-8 sm:pb-20">
          <p className="text-eyebrow text-terracotta">Search the catalogue</p>
          <h1 className="mt-5 font-display text-[clamp(2rem,4.6vw,3.75rem)] font-black uppercase leading-[1.02] tracking-[-0.02em] text-cream">
            {valid ? term : "Find your piece"}
          </h1>
          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-cream/80">
            {valid
              ? total > 0
                ? `${total} ${total === 1 ? "piece" : "pieces"} matched, ordered by ${sortLabel}.`
                : `Nothing matched “${term}” yet - but the workshop can build it.`
              : "Every bench-made piece, every drawing. Type at least two characters to start searching."}
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-5 py-12 sm:px-8 sm:py-16">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <nav aria-label="Category filters" className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
              <Link
                href={`/search?${qs({ q: term, category: undefined, sort })}`}
                className={[
                  "shrink-0 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors",
                  !activeCategory
                    ? "border-espresso bg-espresso text-cream"
                    : "border-espresso/15 bg-white text-espresso/60 hover:border-espresso/40",
                ].join(" ")}
              >
                All
              </Link>
              {CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  href={`/search?${qs({ q: term, category: c.slug, sort })}`}
                  className={[
                    "shrink-0 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors",
                    activeCategory?.slug === c.slug
                      ? "border-espresso bg-espresso text-cream"
                      : "border-espresso/15 bg-white text-espresso/60 hover:border-espresso/40",
                  ].join(" ")}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <c.icon className="size-3.5 shrink-0" aria-hidden="true" />
                    {c.name}
                  </span>
                </Link>
              ))}
            </nav>
          </div>
          <div className="ml-auto flex items-center gap-4">
            {valid && <span className="text-xs text-espresso/45">{total} results</span>}
            <SearchSortInput />
          </div>
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[230px_1fr] lg:gap-14">
          <aside className="hidden lg:block" aria-label="Filter by category">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-espresso/40">
              Browse categories
            </p>
            <ul className="mt-4 space-y-0.5">
              <li>
                <Link
                  href={`/search?${qs({ q: term, category: undefined, sort })}`}
                  className={[
                    "block rounded-full px-4 py-2.5 text-[13px] font-medium transition-colors",
                    !activeCategory ? "bg-espresso text-cream" : "text-espresso/60 hover:bg-espresso/5 hover:text-espresso",
                  ].join(" ")}
                >
                  All categories
                </Link>
              </li>
              {CATEGORIES.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/search?${qs({ q: term, category: c.slug, sort })}`}
                    className={[
                      "flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[13px] font-medium transition-colors",
                      activeCategory?.slug === c.slug
                        ? "bg-espresso text-cream"
                        : "text-espresso/60 hover:bg-espresso/5 hover:text-espresso",
                    ].join(" ")}
                  >
                    <c.icon className="size-4 shrink-0" aria-hidden="true" />
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </aside>

          <div className="min-w-0">
            {!valid ? (
              <Reveal className="rounded-[2rem] border border-espresso/10 bg-white p-10 sm:p-14">
                <RevealItem>
                  <PackageSearch className="size-10 text-terracotta" aria-hidden="true" />
                  <h2 className="mt-5 font-display text-2xl font-black uppercase tracking-[-0.02em] text-espresso">
                    Search the catalogue
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-espresso/60">
                    Try a timber, a room, or a piece -{" "}
                    <span className="font-medium text-espresso">walnut</span>,{" "}
                    <span className="font-medium text-espresso">sofa</span>,{" "}
                    <span className="font-medium text-espresso">desk</span>,{" "}
                    <span className="font-medium text-espresso">bar stool</span>.
                  </p>
                  <div className="mt-8 flex flex-wrap gap-2">
                    {CATEGORIES.slice(0, 8).map((c) => (
                      <Link
                        key={c.slug}
                        href={categoryHref(c.slug)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-espresso/15 bg-cream px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-espresso/60 transition-colors hover:border-terracotta hover:text-terracotta"
                      >
                        <c.icon className="size-3.5 shrink-0" aria-hidden="true" />
                        {c.name}
                      </Link>
                    ))}
                  </div>
                </RevealItem>
              </Reveal>
            ) : products.length === 0 ? (
              <Reveal className="rounded-[2rem] border border-espresso/10 bg-white p-10 sm:p-14">
                <RevealItem>
                  <PackageSearch className="size-10 text-terracotta" aria-hidden="true" />
                  <h2 className="mt-5 font-display text-2xl font-black uppercase tracking-[-0.02em] text-espresso">
                    {categories.length > 0 ? "Browse these instead" : `No matches for “${term}”`}
                  </h2>
                  <p className="mt-3 max-w-md text-sm leading-relaxed text-espresso/60">
                    {categories.length > 0
                      ? "The catalogue has no bench piece that matches that search yet - but the rooms it belongs in are here."
                      : "The workshop makes each piece to order. If it isn’t listed, describe it and we will quote it."}
                  </p>

                  {categories.length > 0 ? (
                    <div className="mt-8 flex flex-wrap gap-2">
                      {categories.map((m) => {
                        const Icon = categoryIcon(m.categorySlug);
                        return (
                          <Link
                            key={m.href}
                            href={m.href}
                            className="inline-flex items-center gap-1.5 rounded-full border border-espresso/15 bg-cream px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-espresso/60 transition-colors hover:border-terracotta hover:text-terracotta"
                          >
                            {Icon && <Icon className="size-3.5 shrink-0" aria-hidden="true" />}
                            {m.name}
                          </Link>
                        );
                      })}
                      {subcategoryNames().length > 0 &&
                        categories.length < 12 && (
                          <span className="flex items-center px-2 text-[11px] text-espresso/35">
                            …or try another term
                          </span>
                        )}
                    </div>
                  ) : (
                    <div className="mt-8 flex flex-wrap gap-3">
                      <Link
                        href="/contact#quote"
                        className="rounded-full bg-espresso px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-terracotta"
                      >
                        Request a custom piece
                      </Link>
                      <Link
                        href="/furniture"
                        className="rounded-full border border-espresso/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso transition-colors hover:border-espresso"
                      >
                        Browse everything
                      </Link>
                    </div>
                  )}
                </RevealItem>
              </Reveal>
            ) : (
              <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {products.map((product, i) => (
                  <ProductCard key={product.id} product={product} index={i} />
                ))}
              </div>
            )}

            {products.length > 0 && pages > 1 && (
              <nav aria-label="Pagination" className="mt-12 flex items-center justify-between">
                {page > 1 ? (
                  <Link
                    href={`/search?${qs({ q: term, category, sort, page: page - 1 })}`}
                    className="inline-flex items-center gap-2 rounded-full border border-espresso/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso transition-colors hover:border-espresso"
                  >
                    <ArrowLeft className="size-4" aria-hidden="true" /> Previous
                  </Link>
                ) : (
                  <span className="px-6 py-3" />
                )}
                <span className="text-xs text-espresso/50">
                  Page {page} of {pages} · {total} results
                </span>
                {page < pages ? (
                  <Link
                    href={`/search?${qs({ q: term, category, sort, page: page + 1 })}`}
                    className="inline-flex items-center gap-2 rounded-full border border-espresso/20 px-6 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso transition-colors hover:border-espresso"
                  >
                    Next <ArrowRight className="size-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <span className="px-6 py-3" />
                )}
              </nav>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import ProductCard from "@/components/ProductCard";
import { getNavigationData } from "@/lib/navigation-data";
import { getProductsForPlacement } from "@/lib/queries";

type Props = { params: Promise<{ "nav-item-slug": string; "section-slug": string }> };

async function findSection(navSlug: string, sectionSlug: string) {
  const navigation = await getNavigationData();
  const item = [...navigation.top_bar, ...navigation.category_bar].find((entry) => entry.slug === navSlug);
  const section = item?.sections.find((entry) => entry.slug === sectionSlug);
  return item && section ? { item, section } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { "nav-item-slug": navSlug, "section-slug": sectionSlug } = await params;
  const match = await findSection(navSlug, sectionSlug);
  return { title: match?.section.name ?? "Shop" };
}

export default async function NavigationSectionPage({ params }: Props) {
  const { "nav-item-slug": navSlug, "section-slug": sectionSlug } = await params;
  const match = await findSection(navSlug, sectionSlug);
  if (!match) notFound();

  const [{ products, total }] = await Promise.all([
    getProductsForPlacement(match.item.id, match.section.id),
  ]);
  return (
    <>
      <PageHero
        eyebrow={`${match.item.label} collection`}
        title={match.section.name}
        intro={match.section.description || `${total} pieces placed in ${match.item.label} > ${match.section.name}.`}
        illustrationSlug={match.section.slug}
        illustrationParentSlug={match.item.slug}
        crumbs={[
          { label: "Catalogue", href: "/furniture" },
          { label: match.item.label, href: `/${match.item.slug}` },
          { label: match.section.name },
        ]}
      />
      <section className="mx-auto max-w-[1600px] px-5 py-14 sm:px-8">
        {products.length ? (
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
          </div>
        ) : <p className="py-16 text-center text-sm text-espresso/55">No products have been placed here yet.</p>}
      </section>
    </>
  );
}
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import ProductCard from "@/components/ProductCard";
import { getNavigationData } from "@/lib/navigation-data";
import { getProductsForPlacement } from "@/lib/queries";

type Props = { params: Promise<{ "nav-item-slug": string }> };

async function findItem(slug: string) {
  const navigation = await getNavigationData();
  return [...navigation.top_bar, ...navigation.category_bar].find((item) => item.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { "nav-item-slug": slug } = await params;
  const item = await findItem(slug);
  return { title: item?.label ?? "Shop" };
}

export default async function NavigationItemPage({ params }: Props) {
  const { "nav-item-slug": slug } = await params;
  const item = await findItem(slug);
  if (!item) notFound();

  const [{ products, total }] = await Promise.all([
    getProductsForPlacement(item.id, item.has_mega_menu ? undefined : null, item.slug),
  ]);

  return (
    <>
      <PageHero
        eyebrow="Shop the range"
        title={item.label}
        intro={item.description || `${total} pieces placed in ${item.label}.`}
        illustrationSlug={item.slug}
        crumbs={[{ label: "Catalogue", href: "/furniture" }, { label: item.label }]}
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
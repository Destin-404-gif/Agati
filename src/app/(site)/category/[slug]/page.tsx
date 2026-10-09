import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import ProductCard from "@/components/ProductCard";
import { getCategories, getProducts } from "@/lib/queries";

type Props = { params: Promise<{ slug: string }> };

async function getCategory(slug: string) {
  const categories = await getCategories();
  return categories.find((category) => category.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategory(slug);
  return { title: category?.name ?? "Shop" };
}

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params;
  const category = await getCategory(slug);
  if (!category) notFound();

  const [{ products, total }] = await Promise.all([
    getProducts({ category: slug, limit: 100 }),
  ]);
  return (
    <>
      <PageHero
        eyebrow="Shop the range"
        title={category.name}
        intro={category.description || `${total} active pieces in ${category.name}.`}
        illustrationSlug={category.slug}
        crumbs={[{ label: "Home", href: "/" }, { label: category.name }]}
      />
      <section className="mx-auto max-w-[1600px] px-5 py-14 sm:px-8">
        {products.length ? (
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
          </div>
        ) : <p className="py-16 text-center text-sm text-espresso/55">No active products in this category yet.</p>}
      </section>
    </>
  );
}
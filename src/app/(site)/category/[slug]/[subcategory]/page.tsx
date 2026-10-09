import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PageHero from "@/components/PageHero";
import ProductCard from "@/components/ProductCard";
import { getCategories, getProducts, getSubcategories } from "@/lib/queries";

type Props = { params: Promise<{ slug: string; subcategory: string }> };

async function getCategoryAndSubcategory(slug: string, subcategorySlug: string) {
  const [categories, subcategories] = await Promise.all([getCategories(), getSubcategories()]);
  const category = categories.find((item) => item.slug === slug);
  const subcategory = category
    ? subcategories.find((item) => item.category_id === category.id && item.slug === subcategorySlug)
    : undefined;
  return category && subcategory ? { category, subcategory } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, subcategory } = await params;
  const match = await getCategoryAndSubcategory(slug, subcategory);
  return { title: match?.subcategory.name ?? "Shop" };
}

export default async function SubcategoryPage({ params }: Props) {
  const { slug, subcategory: subcategorySlug } = await params;
  const match = await getCategoryAndSubcategory(slug, subcategorySlug);
  if (!match) notFound();

  const { category, subcategory } = match;
  const [{ products, total }] = await Promise.all([
    getProducts({ category: slug, subcategory: subcategory.slug, limit: 100 }),
  ]);
  return (
    <>
      <PageHero
        eyebrow={`${category.name} collection`}
        title={subcategory.name}
        intro={`${total} active pieces in ${category.name} > ${subcategory.name}.`}
        illustrationSlug={subcategory.slug}
        illustrationParentSlug={category.slug}
        crumbs={[
          { label: "Home", href: "/" },
          { label: category.name, href: `/category/${category.slug}` },
          { label: subcategory.name },
        ]}
      />
      <section className="mx-auto max-w-[1600px] px-5 py-14 sm:px-8">
        {products.length ? (
          <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {products.map((product, index) => <ProductCard key={product.id} product={product} index={index} />)}
          </div>
        ) : <p className="py-16 text-center text-sm text-espresso/55">No active products in this subcategory yet.</p>}
      </section>
    </>
  );
}
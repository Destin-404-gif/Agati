import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ProductCard from "@/components/ProductCard";
import ProductDetailClient from "@/components/furniture/ProductDetailClient";
import { getProductBySlug, getProducts } from "@/lib/queries";
import { LOCATION, SITE } from "@/lib/siteConfig";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product not found" };

  const description =
    product.description?.slice(0, 155) ??
    `${product.name} from ${SITE.name}, made in ${LOCATION.label}.`;

  return {
    title: product.name,
    description,
    openGraph: {
      title: product.name,
      description,
      images: product.image_url ? [{ url: product.image_url }] : undefined,
    },
  };
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  // A short "you might also like" rail: same category first, then anything else.
  const related = await getProducts(
    product.category_id
      ? { category: product.category_slug ?? undefined }
      : { featured: true },
  );

  const suggestions = related.products
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-24 pt-32 sm:px-8">
      <nav aria-label="Breadcrumb" className="mb-8 text-[11px] uppercase tracking-[0.14em]">
        <ol className="flex flex-wrap items-center gap-2 text-espresso/40">
          <li>
            <Link href="/" className="transition-colors hover:text-espresso">
              Home
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/furniture" className="transition-colors hover:text-espresso">
              Furniture
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-espresso/70" aria-current="page">
            {product.name}
          </li>
        </ol>
      </nav>

      <ProductDetailClient product={product} />

      {suggestions.length > 0 && (
        <section className="mt-24 border-t border-espresso/10 pt-14">
          <h2 className="font-display text-2xl font-black tracking-[-0.02em] text-espresso">
            You might also like
          </h2>
          <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {suggestions.map((p, i) => (
              <li key={p.id}>
                <ProductCard product={p} index={i} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
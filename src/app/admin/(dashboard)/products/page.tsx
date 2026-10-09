import type { Metadata } from "next";
import { ProductsList } from "@/components/admin/ProductsList";
import { Card } from "@/components/admin/ui";
import { getCategories } from "@/lib/queries";
import { requirePermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage() {
  await requirePermission("products.view");
  const categories = await getCategories();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Products
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Everything in the catalogue, including pieces not yet published.
        </p>
      </header>

      <Card>
        <ProductsList
          categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
        />
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/ProductForm";
import { Card } from "@/components/admin/ui";
import { requirePermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requirePermission("products.edit");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          New product
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Add a piece to the catalogue. It appears in the shop as soon as it is
          set to active.
        </p>
      </header>

      <Card>
        <ProductForm />
      </Card>
    </div>
  );
}

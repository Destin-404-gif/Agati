import type { Metadata } from "next";
import { CategoriesList } from "@/components/admin/CategoriesList";
import { Card } from "@/components/admin/ui";
import { requirePermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  await requirePermission("products.view");

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Categories
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Deleting a category keeps its products - they simply become
          uncategorised.
        </p>
      </header>

      <Card>
        <CategoriesList />
      </Card>
    </div>
  );
}

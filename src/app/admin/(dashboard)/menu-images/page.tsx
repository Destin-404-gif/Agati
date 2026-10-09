import type { Metadata } from "next";
import { MenuImagesManager } from "@/components/admin/MenuImagesManager";
import { getMenuImageBoard } from "@/lib/menu-images";
import { requirePermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Menu Images" };

/**
 * The pictures in the mega menus. Read on the server like the gallery's rows, so
 * the board arrives with the page instead of flashing empty while the client
 * fetches it again.
 */
export default async function MenuImagesPage() {
  await requirePermission("products.edit");

  const categories = await getMenuImageBoard();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Menu Images</h1>
        <p className="mt-1 text-sm text-fg-soft">
          Pictures for the right-hand side of each category menu on the website. Up to three per
          category, shown in the order you set.
        </p>
      </header>
      <MenuImagesManager initialCategories={categories} />
    </div>
  );
}
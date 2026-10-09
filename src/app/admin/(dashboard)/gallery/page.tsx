import type { Metadata } from "next";
import { GalleryManager } from "@/components/admin/GalleryManager";
import { getAllGalleryItems } from "@/lib/gallery";
import { requirePermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Gallery" };

/**
 * The workshop gallery. Unlike the media library (which assigns pictures to
 * fixed slots), these rows *are* the storefront gallery, in `sort_order`.
 */
export default async function GalleryPage() {
  await requirePermission("media.edit");

  const items = await getAllGalleryItems();

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Gallery
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Every published photo appears on the storefront gallery in this order.
          Hiding one keeps it here without publishing it.
        </p>
      </header>

      <GalleryManager initialItems={items} />
    </div>
  );
}

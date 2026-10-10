import type { Metadata } from "next";
import { MediaManager } from "@/components/admin/MediaManager";
import { query } from "@/lib/db";
import { getMediaRows, syncMediaSlots } from "@/lib/media";
import { allMediaSlots, type MediaSlotState } from "@/lib/media-slots";
import { requirePermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Media & Banners" };

/**
 * Category panels are open-ended slots, so the grid has to be built from the
 * categories that actually exist rather than a static list.
 */
async function loadCategories(): Promise<{ slug: string; name: string }[]> {
  try {
    return await query<{ slug: string; name: string }>(
      `SELECT slug, name FROM categories ORDER BY name`,
    );
  } catch {
    return [];
  }
}

export default async function MediaPage() {
  await requirePermission("media.edit");

  // Make sure every registry slot has a row, so a fresh database (or a newly
  // added category panel) does not offer slots the API would reject. Idempotent
  // and non-destructive, so it is safe on every render.
  await syncMediaSlots();

  const slots = allMediaSlots(await loadCategories());
  const assets = await getMediaRows();

  const initialSlots: MediaSlotState[] = slots.map((def) => ({
    def,
    current: assets[def.key] ?? null,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Media &amp; Banners
        </h1>
        <p className="mt-1 text-sm text-fg-soft">
          Every image on the storefront comes from a slot below. Changes appear on the
          live site immediately - no rebuild needed.
        </p>
      </header>

      <MediaManager initialSlots={initialSlots} />
    </div>
  );
}
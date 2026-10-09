import { query, type QueryResultRow } from "./db";
import { variantsFromUrls } from "./image-variants";
import {
  MEDIA_SLOTS,
  slotDef,
  type MediaAsset,
  type MediaSlotDef,
} from "./media-slots";

/**
 * The database side of the image registry.
 *
 * Slot metadata lives in `media-slots.ts` (no imports, safe for client code);
 * this module resolves those keys against the `media_slots` table. Public pages
 * import `getMedia`; client components import helpers from `media-slots`.
 */

export type { MediaAsset, MediaKind, MediaSlotDef } from "./media-slots";
export {
  allMediaSlots,
  categorySlot,
  categorySlotDef,
  GALLERY_COUNT,
  gallerySlot,
  HERO_SLIDE_COUNT,
  heroSlideSlot,
  MEDIA_SLOTS,
  PAGE_HERO_PAGES,
  pageHeroSlot,
  PROJECT_COUNT,
  projectSlot,
  SERVICE_COUNT,
  serviceSlot,
  slotDef,
} from "./media-slots";

export interface MediaRow extends QueryResultRow {
  slot_key: string;
  image_url: string | null;
  thumb_url: string | null;
  variant_400_url: string | null;
  variant_1200_url: string | null;
  variant_2560_url: string | null;
  variant_3840_url: string | null;
  original_width: number | null;
  original_height: number | null;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
}

function toAsset(row: MediaRow): MediaAsset | null {
  if (!row.image_url) return null;
  const def: MediaSlotDef | undefined = slotDef(row.slot_key);
  return {
    url: row.image_url,
    thumbUrl: row.thumb_url ?? null,
    variant400Url: row.variant_400_url ?? null,
    variant1200Url: row.variant_1200_url ?? null,
    variant2560Url: row.variant_2560_url ?? null,
    variant3840Url: row.variant_3840_url ?? null,
    variants: variantsFromUrls([
      row.variant_400_url,
      row.variant_1200_url,
      row.variant_2560_url,
      row.variant_3840_url,
    ]),
    alt: row.alt_text?.trim() || def?.alt || "",
    width: row.width ?? null,
    height: row.height ?? null,
    originalWidth: row.original_width ?? null,
    originalHeight: row.original_height ?? null,
    bytes: row.bytes ?? null,
  };
}

/**
 * Resolve the given slot keys to their current assets.
 *
 * A slot with no row, or a row with no image, resolves to `null`, which the
 * storefront renders as a neutral placeholder. A database outage also resolves
 * to `null` rather than throwing, so a page still renders.
 */
export async function getMedia(keys: readonly string[]): Promise<
  Record<string, MediaAsset | null>
> {
  if (keys.length === 0) return {};

  try {
    const rows = await query<MediaRow>(
      `SELECT slot_key, image_url, thumb_url, alt_text, width, height, bytes,
              variant_400_url, variant_1200_url, variant_2560_url, variant_3840_url,
              original_width, original_height
         FROM media_slots
        WHERE slot_key = ANY($1::varchar[])`,
      [[...keys]],
    );

    const result: Record<string, MediaAsset | null> = {};
    for (const key of keys) result[key] = null;
    for (const row of rows) result[row.slot_key] = toAsset(row);
    return result;
  } catch (err) {
    console.error("[media] could not load media slots", err);
    const result: Record<string, MediaAsset | null> = {};
    for (const key of keys) result[key] = null;
    return result;
  }
}

/** The full declared registry, for the admin Media page. */
export async function getMediaRows(): Promise<Record<string, MediaAsset | null>> {
  return getMedia(MEDIA_SLOTS.map((s) => s.key));
}
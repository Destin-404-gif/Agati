import { query, type QueryResultRow } from "./db";
import { variantsFromUrls } from "./image-variants";
import {
  allMediaSlots,
  categorySlotDef,
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

/* ------------------------------------------------------- slot registry sync */

/**
 * Category panels are addressed as `category_<slug>`. The prefix is the inverse
 * of `categorySlot()` in `media-slots.ts`; it is kept here (not exported from
 * the client-safe module) because only the server resolves keys.
 */
const CATEGORY_SLOT_PREFIX = "category_";

/** Where a registry slot sits when its database row is first created. */
function slotPosition(key: string): number {
  const index = MEDIA_SLOTS.findIndex((slot) => slot.key === key);
  return index >= 0 ? index : 1000;
}

export interface ResolvedSlot {
  def: MediaSlotDef;
  position: number;
}

/**
 * Resolve a slot key against the registry - the single source of truth for
 * which slots exist. A static key resolves directly; a category panel resolves
 * against the categories that actually exist in the database. Returns null only
 * for a key the registry does not know.
 */
export async function resolveMediaSlot(key: string): Promise<ResolvedSlot | null> {
  const known = slotDef(key);
  if (known) return { def: known, position: slotPosition(key) };

  if (key.startsWith(CATEGORY_SLOT_PREFIX)) {
    const slug = key.slice(CATEGORY_SLOT_PREFIX.length);
    if (slug) {
      const rows = await query<{ slug: string; name: string }>(
        `SELECT slug, name FROM categories WHERE slug = $1`,
        [slug],
      );
      if (rows[0]) {
        return { def: categorySlotDef(rows[0].slug, rows[0].name), position: 1000 };
      }
    }
  }

  return null;
}

/**
 * Guarantee a slot has a row so it can be assigned to. Creates it from the
 * registry on first use and never touches an existing row, so it is safe to
 * call on every request. Returns null for a key the registry does not know -
 * the only case a caller should reject.
 */
export async function ensureMediaSlot(key: string): Promise<ResolvedSlot | null> {
  const resolved = await resolveMediaSlot(key);
  if (!resolved) return null;

  await query(
    `INSERT INTO media_slots (slot_key, label, group_name, kind, alt_text, position)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (slot_key) DO NOTHING`,
    [
      resolved.def.key,
      resolved.def.label,
      resolved.def.group,
      resolved.def.kind,
      resolved.def.alt || null,
      resolved.position,
    ],
  );

  return resolved;
}

/**
 * Ensure every registry slot has a row, without overwriting anything.
 *
 * A fresh database (every Render deploy) has no `media_slots` rows, so without
 * this the admin page would offer slots the API then rejects. It is idempotent
 * and non-destructive: assigned images are never changed. Called on each render
 * of the admin Media page, which is what makes it effectively "run on deploy".
 */
export async function syncMediaSlots(): Promise<void> {
  let categories: { slug: string; name: string }[] = [];
  try {
    categories = await query<{ slug: string; name: string }>(
      `SELECT slug, name FROM categories ORDER BY name`,
    );
  } catch (err) {
    console.error("[media] could not load categories for slot sync", err);
  }

  const defs = allMediaSlots(categories);
  await query(
    `INSERT INTO media_slots (slot_key, label, group_name, kind, alt_text, position)
     SELECT * FROM UNNEST($1::varchar[], $2::varchar[], $3::varchar[], $4::varchar[], $5::varchar[], $6::int[])
     ON CONFLICT (slot_key) DO NOTHING`,
    [
      defs.map((def) => def.key),
      defs.map((def) => def.label),
      defs.map((def) => def.group),
      defs.map((def) => def.kind),
      defs.map((def) => def.alt || null),
      defs.map((_def, index) => index),
    ],
  );
}
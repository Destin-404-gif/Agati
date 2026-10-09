import { query, type QueryResultRow } from "./db";

/**
 * The workshop gallery, managed from the admin.
 *
 * The public page reads only published rows, in `sort_order`; the admin grid
 * reads everything so unpublished work is still visible to the person editing
 * it. Both go through this module so the column list exists once.
 */

export interface GalleryItem extends QueryResultRow {
  id: number;
  image_url: string;
  thumbnail_url: string | null;
  variant_400_url: string | null;
  variant_1200_url: string | null;
  variant_2560_url: string | null;
  variant_3840_url: string | null;
  image_width: number | null;
  image_height: number | null;
  image_bytes: number | null;
  title: string | null;
  caption: string | null;
  alt_text: string | null;
  sort_order: number;
  is_published: boolean;
  created_at: string;
}

const COLUMNS = `id, image_url, thumbnail_url,
                 variant_400_url, variant_1200_url, variant_2560_url, variant_3840_url,
                 image_width, image_height, image_bytes,
                 title, caption, alt_text,
                 sort_order, is_published, created_at`;

/** Everything the admin grid shows, newest ordering last. */
export async function getAllGalleryItems(): Promise<GalleryItem[]> {
  return query<GalleryItem>(
    `SELECT ${COLUMNS} FROM gallery_items ORDER BY sort_order ASC, id ASC`,
  );
}

/** What the public page shows. */
export async function getPublishedGalleryItems(): Promise<GalleryItem[]> {
  return query<GalleryItem>(
    `SELECT ${COLUMNS}
       FROM gallery_items
      WHERE is_published = TRUE
      ORDER BY sort_order ASC, id ASC`,
  );
}

/** The next free sort position, so a new upload lands at the end of the grid. */
export async function nextGallerySortOrder(): Promise<number> {
  const rows = await query<{ next: number }>(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM gallery_items`,
  );
  return rows[0]?.next ?? 0;
}
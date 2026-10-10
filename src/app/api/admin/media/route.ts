import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { ensureMediaSlot } from "@/lib/media";

export const dynamic = "force-dynamic";

/**
 * Read and write media slots.
 *
 * `GET` returns every slot the admin grid shows - the declared registry plus one
 * panel per category - with the current asset for each. `PATCH` points a slot
 * at a file from the library, or clears it so the storefront falls back to the
 * neutral placeholder.
 */

const patchSchema = z.object({
  slotKey: z.string().trim().min(1).max(80),
  /** A url from `media_uploads`, or null to clear the slot. */
  url: z.string().trim().max(500).nullable(),
  altText: z.string().trim().max(300).optional(),
});

const listSchema = z.object({
  group: z.string().trim().max(60).optional(),
  q: z.string().trim().max(80).optional(),
});

type UploadRow = {
  id: number;
  url: string;
  thumb_url: string | null;
  original_name: string | null;
  mime: string | null;
  alt_text: string | null;
  bytes: number | null;
  width: number | null;
  height: number | null;
  variant_400_url: string | null;
  variant_1200_url: string | null;
  variant_2560_url: string | null;
  variant_3840_url: string | null;
  created_at: string;
  created_by: string | null;
};

export const GET = withAuth(
  async ({ req }) => {
    const params = listSchema.parse({
      group: new URL(req.url).searchParams.get("group") ?? undefined,
      q: new URL(req.url).searchParams.get("q") ?? undefined,
    });

    // `group_name` lives on media_slots, not on the upload itself, so a group
// filter means "files this group currently uses".
const uploads = await query<UploadRow>(
      `SELECT u.id, u.url, u.thumb_url, u.original_name, u.mime, u.alt_text, u.bytes,
              u.width, u.height, u.variant_400_url, u.variant_1200_url,
              u.variant_2560_url, u.variant_3840_url, u.created_at, u.created_by
         FROM media_uploads u
        WHERE ($1::text IS NULL OR EXISTS (
                SELECT 1 FROM media_slots s
                 WHERE s.group_name = $1
                   AND (s.image_url = u.url OR s.thumb_url = u.url)))
          AND ($2::text IS NULL OR u.original_name ILIKE '%' || $2 || '%'
               OR u.url ILIKE '%' || $2 || '%')
        ORDER BY u.created_at DESC, u.id DESC
        LIMIT 200`,
      [params.group || null, params.q || null],
    );

    return NextResponse.json({ uploads });
  },
  { permissions: ["media.edit", "content.edit"] },
);

export const PATCH = withAuth(
  async ({ req, staff }) => {
    const body = await readJson(req, patchSchema);
    const { slotKey, url, altText } = body;

    // The registry (`src/lib/media-slots.ts`) is the single source of truth for
    // which slot keys the admin UI offers. Ensure the row exists before writing:
    // a slot that is in the registry but has no row yet (a fresh database, or a
    // category panel added since the last seed) is created on first assign
    // rather than rejected. Only a key the registry does not know is an error,
    // and the message names it so a mismatch can be debugged.
    const resolved = await ensureMediaSlot(slotKey);
    if (!resolved) {
      return NextResponse.json(
        { error: `Unknown image slot: ${slotKey}` },
        { status: 400 },
      );
    }

    const slot = await query<{ slot_key: string; label: string; image_url: string | null }>(
      `SELECT slot_key, label, image_url FROM media_slots WHERE slot_key = $1`,
      [slotKey],
    );
    const target = slot[0]!;

    if (url === null) {
      await query(
        `UPDATE media_slots
            SET image_url = NULL, thumb_url = NULL, width = NULL, height = NULL,
                bytes = NULL, variant_400_url = NULL, variant_1200_url = NULL,
                variant_2560_url = NULL, variant_3840_url = NULL,
                original_width = NULL, original_height = NULL,
                updated_at = NOW(), updated_by = $2
          WHERE slot_key = $1`,
        [slotKey, staff.email],
      );
    } else {
      const file = await query<{
        url: string;
        thumb_url: string | null;
        width: number | null;
        height: number | null;
        bytes: number | null;
        variant_400_url: string | null;
        variant_1200_url: string | null;
        variant_2560_url: string | null;
        variant_3840_url: string | null;
        original_width: number | null;
        original_height: number | null;
      }>(
        `SELECT url, thumb_url, width, height, bytes,
                variant_400_url, variant_1200_url, variant_2560_url, variant_3840_url,
                original_width, original_height
           FROM media_uploads WHERE url = $1`,
        [url],
      );
      const asset = file[0];
      if (!asset) {
        return NextResponse.json(
          { error: "That image is not in the media library." },
          { status: 400 },
        );
      }

      await query(
        `UPDATE media_slots
            SET image_url = $2, thumb_url = $3, width = $4, height = $5, bytes = $6,
                variant_400_url = $9, variant_1200_url = $10,
                variant_2560_url = $11, variant_3840_url = $12,
                original_width = $13, original_height = $14,
                alt_text = COALESCE($7, alt_text),
                updated_at = NOW(), updated_by = $8
          WHERE slot_key = $1`,
        [
          slotKey,
          asset.url,
          asset.thumb_url,
          asset.width,
          asset.height,
          asset.bytes,
          altText ?? null,
          staff.email,
          asset.variant_400_url,
          asset.variant_1200_url,
          asset.variant_2560_url,
          asset.variant_3840_url,
          asset.original_width,
          asset.original_height,
        ],
      );
    }

    const after = await query<{
      slot_key: string;
      image_url: string | null;
      thumb_url: string | null;
      alt_text: string | null;
    }>(
      `SELECT slot_key, image_url, thumb_url, alt_text
         FROM media_slots WHERE slot_key = $1`,
      [slotKey],
    );

    await logAudit({
      action: "update",
      entity: "media_slot",
      entityId: slotKey,
      before: { image_url: target.image_url },
      after: after[0],
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json({ ok: true, slot: after[0] });
  },
  { permissions: ["media.edit", "content.edit"] },
);
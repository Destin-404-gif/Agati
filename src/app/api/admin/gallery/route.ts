import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { nextGallerySortOrder } from "@/lib/gallery";
import { removeStoredFiles, storeUpload } from "@/lib/media-upload";
import { revalidateGallery } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

/**
 * The workshop gallery.
 *
 * `GET` lists every item for the admin grid (published or not). `POST` takes a
 * multipart upload with optional title/caption/alt, runs it through the shared
 * `storeUpload` handler and inserts the row, so one request both stores the
 * file and creates the record the grid renders.
 */

const ReorderBody = z.object({
  ids: z.array(z.number().int().positive()).min(1).max(500),
});

export const GET = withAuth(async () => {
  const rows = await query(
    `SELECT id, image_url, thumbnail_url,
            variant_400_url, variant_1200_url, variant_2560_url, variant_3840_url,
            image_width, image_height, image_bytes,
            title, caption, alt_text, sort_order, is_published, created_at
       FROM gallery_items
      ORDER BY sort_order ASC, id ASC`,
  );
  return NextResponse.json({ rows, total: rows.length });
});

export const POST = withAuth(
  async ({ req, staff }) => {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }

    // `null` slotKey means "a photo": jpg/png/webp only, 5MB, real signature.
    const result = await storeUpload(file, null, staff.email);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const text = (key: string, max: number): string | null => {
      const raw = form?.get(key);
      if (typeof raw !== "string") return null;
      const value = raw.trim().slice(0, max);
      return value === "" ? null : value;
    };

    // Falls back to the file's own name so a freshly dropped grid of photos is
    // labelled with something recognisable instead of being all blanks.
    const fallbackTitle = result.upload.originalName.replace(/\.[^.]+$/, "").slice(0, 150);

    const sortOrder = await nextGallerySortOrder();

    const rows = await query(
      `INSERT INTO gallery_items
         (image_url, thumbnail_url, variant_400_url, variant_1200_url,
          variant_2560_url, variant_3840_url, image_width, image_height, image_bytes,
          original_width, original_height,
          title, caption, alt_text, sort_order, is_published)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,TRUE)
       RETURNING id, image_url, thumbnail_url, variant_400_url, variant_1200_url,
                 variant_2560_url, variant_3840_url, image_width, image_height, image_bytes,
                 title, caption, alt_text, sort_order, is_published, created_at`,
      [
        result.upload.url,
        result.upload.thumbUrl,
        result.upload.variant400Url,
        result.upload.variant1200Url,
        result.upload.variant2560Url,
        result.upload.variant3840Url,
        result.upload.width,
        result.upload.height,
        result.upload.bytes,
        result.upload.originalWidth,
        result.upload.originalHeight,
        text("title", 150) ?? fallbackTitle,
        text("caption", 2000),
        text("alt", 300),
        sortOrder,
      ],
    );

    await logAudit({
      action: "create",
      entity: "gallery_item",
      entityId: (rows[0] as { id: number }).id,
      after: { url: result.upload.url, bytes: result.upload.bytes },
      staff: { id: staff.id, email: staff.email },
    });

    revalidateGallery();

    return NextResponse.json(
      {
        ok: true,
        id: (rows[0] as { id: number }).id,
        url: result.upload.url,
        thumbUrl: result.upload.thumbUrl,
        item: rows[0],
      },
      { status: 201 },
    );
  },
  { permissions: ["media.edit", "content.edit", "products.edit"] },
);

/** Reorder the whole grid in one call: array order becomes `sort_order`. */
export const PATCH = withAuth(
  async ({ req, staff }) => {
    const parsed = ReorderBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Send the ordered list of items." }, { status: 400 });
    }

    for (const [index, id] of parsed.data.ids.entries()) {
      await query("UPDATE gallery_items SET sort_order = $1 WHERE id = $2", [index, id]);
    }

    await logAudit({
      action: "update",
      entity: "gallery_item",
      after: { reordered: parsed.data.ids.length },
      staff: { id: staff.id, email: staff.email },
    });

    revalidateGallery();

    return NextResponse.json({ ok: true, reordered: parsed.data.ids.length });
  },
  { permissions: ["media.edit", "content.edit"] },
);
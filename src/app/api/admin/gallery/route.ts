import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { nextGallerySortOrder } from "@/lib/gallery";
import { imageUrlProblem, normalizeImageUrl } from "@/lib/image-link";
import { revalidateGallery } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

/**
 * The workshop gallery.
 *
 * `GET` lists every item for the admin grid (published or not). `POST` takes a
 * pasted https image link and inserts the row, so one request both sets the
 * picture and creates the record the grid renders.
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
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

    const text = (value: unknown, max: number): string | null => {
      if (typeof value !== "string") return null;
      const trimmed = value.trim().slice(0, max);
      return trimmed === "" ? null : trimmed;
    };

    const linkCandidate = typeof body.url === "string" ? body.url : "";
    const problem = imageUrlProblem(linkCandidate);
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }

    const url = normalizeImageUrl(linkCandidate);
    const thumbUrl = url;

    const sortOrder = await nextGallerySortOrder();

    const rows = await query(
      `INSERT INTO gallery_items
         (image_url, thumbnail_url, variant_400_url, variant_1200_url,
          variant_2560_url, variant_3840_url, image_width, image_height, image_bytes,
          original_width, original_height,
          title, caption, alt_text, sort_order, is_published)
       VALUES ($1,$2,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,$3,$4,$5,$6,TRUE)
       RETURNING id, image_url, thumbnail_url, variant_400_url, variant_1200_url,
                 variant_2560_url, variant_3840_url, image_width, image_height, image_bytes,
                 title, caption, alt_text, sort_order, is_published, created_at`,
      [
        url,
        thumbUrl,
        text(body.title, 150),
        text(body.caption, 2000),
        text(body.alt, 300),
        sortOrder,
      ],
    );

    await logAudit({
      action: "create",
      entity: "gallery_item",
      entityId: (rows[0] as { id: number }).id,
      after: { url },
      staff: { id: staff.id, email: staff.email },
    });

    revalidateGallery();

    return NextResponse.json(
      {
        ok: true,
        id: (rows[0] as { id: number }).id,
        url,
        thumbUrl,
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
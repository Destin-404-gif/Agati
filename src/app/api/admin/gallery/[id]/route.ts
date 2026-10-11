import { NextResponse } from "next/server";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { imageUrlProblem } from "@/lib/image-link";
import { resolveImageLink } from "@/lib/image-resolve";
import { revalidateGallery } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

/**
 * Edit or delete one gallery item.
 *
 * `PATCH` merges whichever fields were sent over the row that is already there,
 * so the grid can save a single edit without sending the whole item back.
 * `DELETE` removes the row; the picture itself lives on whatever host the link
 * points at, so there are no local bytes to clean up.
 */

function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

interface GalleryRow {
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

const ROW_COLUMNS = `id, image_url, thumbnail_url,
  variant_400_url, variant_1200_url, variant_2560_url, variant_3840_url,
  image_width, image_height, image_bytes,
  title, caption, alt_text, sort_order, is_published, created_at`;

export const PATCH = withAuth<{ id: string }>(
  async ({ req, params, staff }) => {
    const id = parseId(params.id);
    if (id === null) {
      return NextResponse.json({ error: "Unknown gallery item." }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      title?: unknown;
      caption?: unknown;
      altText?: unknown;
      isPublished?: unknown;
      sortOrder?: unknown;
      imageUrl?: unknown;
    };

    const current = await query<GalleryRow>(
      `SELECT ${ROW_COLUMNS} FROM gallery_items WHERE id = $1`,
      [id],
    );
    if (current.length === 0) {
      return NextResponse.json({ error: "Unknown gallery item." }, { status: 404 });
    }

    const row = current[0];

    // Only keys actually present in the request are applied.
    const asText = (value: unknown, max: number, fallback: string | null) => {
      if (value === undefined) return fallback;
      if (value === null) return null;
      const text = String(value).trim().slice(0, max);
      return text === "" ? null : text;
    };

    const sortOrder =
      typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
        ? Math.trunc(body.sortOrder)
        : typeof body.sortOrder === "string" && /^\d+$/.test(body.sortOrder)
          ? Number(body.sortOrder)
          : row.sort_order;

    // Replace the picture when a new URL was sent. A link has no variant family,
    // so the old ones are cleared; the old local file is removed if it was ours.
    let imageUrl = row.image_url;
    let clearVariants = false;
    if (body.imageUrl !== undefined) {
      const raw = body.imageUrl === null ? "" : String(body.imageUrl);
      if (raw.trim()) {
        const problem = imageUrlProblem(raw);
        if (problem) {
          return NextResponse.json({ error: problem }, { status: 400 });
        }
        const normalized = await resolveImageLink(raw);
        if (normalized !== row.image_url) {
          imageUrl = normalized;
          clearVariants = true;
        }
      }
    }

    const rows = await query<GalleryRow>(
      `UPDATE gallery_items
          SET image_url = $2, title = $3, caption = $4, alt_text = $5,
              is_published = $6, sort_order = $7,
              thumbnail_url = CASE WHEN $8 THEN $2 ELSE thumbnail_url END,
              variant_400_url = CASE WHEN $8 THEN NULL ELSE variant_400_url END,
              variant_1200_url = CASE WHEN $8 THEN NULL ELSE variant_1200_url END,
              variant_2560_url = CASE WHEN $8 THEN NULL ELSE variant_2560_url END,
              variant_3840_url = CASE WHEN $8 THEN NULL ELSE variant_3840_url END
        WHERE id = $1
        RETURNING ${ROW_COLUMNS}`,
      [
        id,
        imageUrl,
        asText(body.title, 150, row.title),
        asText(body.caption, 2000, row.caption),
        asText(body.altText, 300, row.alt_text),
        body.isPublished === undefined ? row.is_published : Boolean(body.isPublished),
        sortOrder,
        clearVariants,
      ],
    );

    await logAudit({
      action: "update",
      entity: "gallery_item",
      entityId: id,
      before: row,
      after: rows[0],
      staff: { id: staff.id, email: staff.email },
    });

    revalidateGallery();

    return NextResponse.json(rows[0]);
  },
  { permissions: ["media.edit", "content.edit"] },
);

export const DELETE = withAuth<{ id: string }>(
  async ({ params, staff }) => {
    const id = parseId(params.id);
    if (id === null) {
      return NextResponse.json({ error: "Unknown gallery item." }, { status: 404 });
    }

    const rows = await query<{ image_url: string; thumbnail_url: string | null }>(
      "DELETE FROM gallery_items WHERE id = $1 RETURNING image_url, thumbnail_url",
      [id],
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Unknown gallery item." }, { status: 404 });
    }

    await logAudit({
      action: "delete",
      entity: "gallery_item",
      entityId: id,
      before: rows[0],
      staff: { id: staff.id, email: staff.email },
    });

    revalidateGallery();

    return NextResponse.json({ ok: true, id });
  },
  { permissions: ["media.edit", "content.edit"] },
);
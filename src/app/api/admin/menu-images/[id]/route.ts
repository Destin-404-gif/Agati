import { NextResponse } from "next/server";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { imageUrlProblem, normalizeImageUrl } from "@/lib/image-link";
import { linkUrlProblem, normalizeCaption, normalizeLinkUrl } from "@/lib/menu-images";
import { revalidateMenuImages } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

/**
 * Edit or delete one menu image.
 *
 * `PATCH` merges whichever fields were sent over the row that is already there,
 * so saving a caption does not have to resend the link, and vice versa.
 *
 * `DELETE` removes the row; the picture itself lives on whatever host the link
 * points at, so there are no local bytes to clean up.
 */

const MENU_IMAGE_PERMISSIONS = ["media.edit", "products.edit"];

function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

interface MenuImageRow {
  id: number;
  category_id: number;
  image_path: string;
  caption: string | null;
  link_url: string | null;
  sort_order: number;
}

const ROW_COLUMNS = "id, category_id, image_path, caption, link_url, sort_order";

export const PATCH = withAuth<{ id: string }>(
  async ({ req, params, staff }) => {
    const id = parseId(params.id);
    if (id === null) {
      return NextResponse.json({ error: "Unknown menu image." }, { status: 404 });
    }

    const current = await query<MenuImageRow>(
      `SELECT ${ROW_COLUMNS} FROM menu_images WHERE id = $1`,
      [id],
    );
    if (current.length === 0) {
      return NextResponse.json({ error: "Unknown menu image." }, { status: 404 });
    }
    const row = current[0];

    const body = (await req.json().catch(() => ({}))) as {
      caption?: unknown;
      linkUrl?: unknown;
      imagePath?: unknown;
    };

    // Only keys actually present in the request are applied.
    const asText = (value: unknown, max: number, fallback: string | null) => {
      if (value === undefined) return fallback;
      if (value === null) return null;
      const text = String(value).trim().slice(0, max);
      return text === "" ? null : text;
    };

    const caption = normalizeCaption(asText(body.caption, 200, row.caption));

    let linkUrl = row.link_url;
    if (body.linkUrl !== undefined) {
      const raw = body.linkUrl === null ? "" : String(body.linkUrl);
      const problem = linkUrlProblem(raw);
      if (problem) {
        return NextResponse.json({ error: problem }, { status: 400 });
      }
      linkUrl = normalizeLinkUrl(raw);
    }

    // Replace the picture itself when a new image URL was sent. This is how a
    // link (instead of a device upload) changes an existing menu picture.
    let imagePath = row.image_path;
    if (body.imagePath !== undefined) {
      const raw = body.imagePath === null ? "" : String(body.imagePath);
      if (raw.trim()) {
        const problem = imageUrlProblem(raw);
        if (problem) {
          return NextResponse.json({ error: problem }, { status: 400 });
        }
        imagePath = normalizeImageUrl(raw);
      }
    }

    const rows = await query<MenuImageRow>(
      `UPDATE menu_images SET caption = $2, link_url = $3, image_path = $4
        WHERE id = $1
        RETURNING ${ROW_COLUMNS}`,
      [id, caption, linkUrl, imagePath],
    );

    await logAudit({
      action: "update",
      entity: "menu_image",
      entityId: id,
      before: { caption: row.caption, link_url: row.link_url },
      after: { caption, link_url: linkUrl },
      staff: { id: staff.id, email: staff.email },
    });

    revalidateMenuImages();

    return NextResponse.json({ ok: true, image: rows[0] });
  },
  { permissions: MENU_IMAGE_PERMISSIONS },
);

export const DELETE = withAuth<{ id: string }>(
  async ({ params, staff }) => {
    const id = parseId(params.id);
    if (id === null) {
      return NextResponse.json({ error: "Unknown menu image." }, { status: 404 });
    }

    const rows = await query<MenuImageRow>(
      `DELETE FROM menu_images WHERE id = $1 RETURNING ${ROW_COLUMNS}`,
      [id],
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Unknown menu image." }, { status: 404 });
    }
    const row = rows[0];

    // Close the gap the deleted row left, so the remaining pictures keep their
    // 0,1,2 order and a later reorder only ever swaps neighbours.
    await query(
      `UPDATE menu_images SET sort_order = sort_order - 1
        WHERE category_id = $1 AND sort_order > $2`,
      [row.category_id, row.sort_order],
    );

    await logAudit({
      action: "delete",
      entity: "menu_image",
      entityId: id,
      before: { category_id: row.category_id, url: row.image_path, caption: row.caption },
      staff: { id: staff.id, email: staff.email },
    });

    revalidateMenuImages();

    return NextResponse.json({ ok: true, id });
  },
  { permissions: MENU_IMAGE_PERMISSIONS },
);
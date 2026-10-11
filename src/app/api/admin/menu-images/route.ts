import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { imageUrlProblem } from "@/lib/image-link";
import { resolveImageLink } from "@/lib/image-resolve";
import {
  MENU_IMAGES_PER_CATEGORY,
  countMenuImages,
  findMenuCategory,
  getMenuImageBoard,
  linkUrlProblem,
  normalizeCaption,
  normalizeLinkUrl,
} from "@/lib/menu-images";
import { revalidateMenuImages } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

/**
 * The admin "Menu Images" board.
 *
 * `GET` returns every active category with its pictures, including the empty
 * ones - the screen is built around the ten categories, not around the rows that
 * happen to exist.
 *
 * `POST` adds one picture from a pasted https link, stored as a string, so the
 * board needs no local files at all.
 *
 * `PATCH` reorders one category: array order becomes `sort_order`.
 *
 * Admin-only (`media.edit` or `products.edit`), same-origin enforced by the CSRF
 * check in `src/proxy.ts`, and every value reaches Postgres as a bound parameter.
 */

/** Editing the order never touches the files, so no upload handling here. */
const ReorderBody = z.object({
  categoryId: z.number().int().positive(),
  ids: z.array(z.number().int().positive()).min(1).max(MENU_IMAGES_PER_CATEGORY),
});

const MENU_IMAGE_PERMISSIONS = ["media.edit", "products.edit"];

export const GET = withAuth(async () => {
  const categories = await getMenuImageBoard();
  return NextResponse.json({ categories, total: categories.length });
}, { permissions: MENU_IMAGE_PERMISSIONS });

export const POST = withAuth(
  async ({ req, staff }) => {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const categoryId = Number(body.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return NextResponse.json({ error: "Choose a category first." }, { status: 400 });
    }

    const category = await findMenuCategory(categoryId);
    if (!category) {
      return NextResponse.json({ error: "Unknown category." }, { status: 404 });
    }

    const caption = normalizeCaption(typeof body.caption === "string" ? body.caption : null);

    const rawLinkText = typeof body.linkUrl === "string" ? body.linkUrl : "";
    const linkProblem = linkUrlProblem(rawLinkText);
    if (linkProblem) {
      return NextResponse.json({ error: linkProblem }, { status: 400 });
    }
    const linkUrl = normalizeLinkUrl(rawLinkText);

    const existing = await countMenuImages(categoryId);
    if (existing >= MENU_IMAGES_PER_CATEGORY) {
      return NextResponse.json(
        {
          error: `${category.name} already has ${MENU_IMAGES_PER_CATEGORY} images. Delete one before adding another.`,
        },
        { status: 409 },
      );
    }

    const linkCandidate = typeof body.url === "string" ? body.url : "";
    const problem = imageUrlProblem(linkCandidate);
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }
    const normalized = await resolveImageLink(linkCandidate);
    if (!normalized) {
      return NextResponse.json({ error: "Paste an image link." }, { status: 400 });
    }
    const imagePath = normalized;

    const rows = await query<{ id: number }>(
      `INSERT INTO menu_images (category_id, image_path, caption, link_url, sort_order)
            VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
      [categoryId, imagePath, caption, linkUrl, existing],
    );
    const id = rows[0].id;

    await logAudit({
      action: "create",
      entity: "menu_image",
      entityId: id,
      after: {
        category: category.slug,
        url: imagePath,
        caption,
        link_url: linkUrl,
      },
      staff: { id: staff.id, email: staff.email },
    });

    revalidateMenuImages();

    return NextResponse.json(
      {
        ok: true,
        id,
        url: imagePath,
        thumbUrl: imagePath,
        categoryId,
        slot: existing,
      },
      { status: 201 },
    );
  },
  { permissions: MENU_IMAGE_PERMISSIONS },
);

export const PATCH = withAuth(
  async ({ req, staff }) => {
    const parsed = ReorderBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: "Send the ordered list of images." }, { status: 400 });
    }

    const { categoryId, ids } = parsed.data;

    const category = await findMenuCategory(categoryId);
    if (!category) {
      return NextResponse.json({ error: "Unknown category." }, { status: 404 });
    }

    // Every id in the payload has to belong to this category, otherwise a reorder
    // could renumber another category's pictures by accident.
    const owned = await query<{ id: number }>(
      `SELECT id FROM menu_images WHERE category_id = $1 AND id = ANY($2::int[])`,
      [categoryId, ids],
    );
    if (owned.length !== new Set(ids).size) {
      return NextResponse.json(
        { error: "One of those images is no longer in this category. Reload and try again." },
        { status: 409 },
      );
    }

    for (const [index, id] of ids.entries()) {
      await query(`UPDATE menu_images SET sort_order = $1 WHERE id = $2 AND category_id = $3`, [
        index,
        id,
        categoryId,
      ]);
    }

    await logAudit({
      action: "update",
      entity: "menu_image",
      after: { category: category.slug, reordered: ids.length },
      staff: { id: staff.id, email: staff.email },
    });

    revalidateMenuImages();

    return NextResponse.json({ ok: true, categoryId, ids });
  },
  { permissions: MENU_IMAGE_PERMISSIONS },
);

/** Removing the file behind a picture is the [id] route's job, not a bulk one. */
export const DELETE = withAuth(
  async () =>
    NextResponse.json(
      { error: "Delete one image at a time: DELETE /api/admin/menu-images/{id}." },
      { status: 405 },
    ),
  { permissions: MENU_IMAGE_PERMISSIONS },
);
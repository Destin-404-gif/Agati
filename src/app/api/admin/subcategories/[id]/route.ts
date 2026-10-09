import { NextResponse } from "next/server";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { removeStoredFiles } from "@/lib/media-upload";
import { revalidateTaxonomy } from "@/lib/revalidate";
import { subcategoryInput } from "../../categories/_shared";

export const dynamic = "force-dynamic";

/** Rename, re-slug, re-alt or delete one subcategory. */

function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const PUT = withAuth<{ id: string }>(
  async ({ req, params, staff }) => {
    const id = parseId(params.id);
    if (id === null) {
      return NextResponse.json({ error: "Unknown subcategory." }, { status: 404 });
    }

    const body = subcategoryInput.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json(
        { error: body.error.issues[0]?.message ?? "Check the fields." },
        { status: 400 },
      );
    }

    const existing = await query<{ id: number; image_url: string | null }>(
      "SELECT id, image_url FROM subcategories WHERE id = $1",
      [id],
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: "Unknown subcategory." }, { status: 404 });
    }

    const { categoryId, name, slug, image_url, image_alt, position } = body.data;
    const cleanSlug = slug.trim().toLowerCase();

    const clash = await query(
      "SELECT id FROM subcategories WHERE category_id = $1 AND slug = $2 AND id <> $3",
      [categoryId, cleanSlug, id],
    );
    if (clash.length > 0) {
      return NextResponse.json(
        { error: "That slug is already used under this category." },
        { status: 409 },
      );
    }

    const previousUrl = existing[0].image_url;
    const nextUrl = image_url || null;

    const rows = await query(
      `UPDATE subcategories
          SET category_id = $1, name = $2, slug = $3, image_url = $4,
              image_alt = $5, position = $6
        WHERE id = $7
        RETURNING id, category_id, name, slug, image_url, image_alt, position`,
      [
        categoryId,
        name.trim(),
        cleanSlug,
        nextUrl,
        image_alt || null,
        position,
        id,
      ],
    );

    // Replacing the picture (or clearing it) orphans the old file.
    if (previousUrl && previousUrl !== nextUrl) {
      await removeStoredFiles([previousUrl]);
    }

    await logAudit({
      action: "update",
      entity: "subcategory",
      entityId: id,
      before: { name: existing[0], image_url: previousUrl },
      after: rows[0],
      staff: { id: staff.id, email: staff.email },
    });

    revalidateTaxonomy();

    return NextResponse.json(rows[0]);
  },
  { permissions: ["products.edit"] },
);

export const DELETE = withAuth<{ id: string }>(
  async ({ params, staff }) => {
    const id = parseId(params.id);
    if (id === null) {
      return NextResponse.json({ error: "Unknown subcategory." }, { status: 404 });
    }

    const rows = await query<{ id: number; image_url: string | null; category_id: number }>(
      "DELETE FROM subcategories WHERE id = $1 RETURNING id, image_url, category_id",
      [id],
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Unknown subcategory." }, { status: 404 });
    }

    await removeStoredFiles([rows[0].image_url]);

    await logAudit({
      action: "delete",
      entity: "subcategory",
      entityId: id,
      before: rows[0],
      staff: { id: staff.id, email: staff.email },
    });

    revalidateTaxonomy();

    return NextResponse.json({ ok: true, id });
  },
  { permissions: ["products.edit"] },
);
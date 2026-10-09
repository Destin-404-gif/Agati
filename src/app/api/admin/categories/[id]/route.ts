import { NextResponse } from "next/server";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { removeStoredFiles } from "@/lib/media-upload";
import { revalidateTaxonomy } from "@/lib/revalidate";
import { categoryInput } from "../_shared";

export const dynamic = "force-dynamic";

export const GET = withAuth(async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Unknown category." }, { status: 404 });
  }

  const rows = await query(
    `SELECT c.*,
            (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id)
              AS product_count
       FROM categories c WHERE c.id = $1`,
    [id],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Unknown category." }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
});

export const PUT = withAuth(
  async ({ req, params, staff }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Unknown category." }, { status: 404 });
    }

    const body = categoryInput.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json(
        { error: body.error.issues[0]?.message ?? "Check the fields." },
        { status: 400 },
      );
    }

    const existing = await query("SELECT * FROM categories WHERE id = $1", [id]);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Unknown category." }, { status: 404 });
    }

    const { name, slug, image_url, image_alt } = body.data;
    const cleanSlug = slug.trim().toLowerCase();

    const clash = await query("SELECT id FROM categories WHERE slug = $1 AND id <> $2", [
      cleanSlug,
      id,
    ]);
    if (clash.length > 0) {
      return NextResponse.json(
        { error: "That slug is already used by another category." },
        { status: 409 },
      );
    }

    const rows = await query(
      `UPDATE categories SET name = $1, slug = $2, image_url = $3, image_alt = $4
        WHERE id = $5 RETURNING id, name, slug, image_url, image_alt`,
      [name.trim(), cleanSlug, image_url || null, image_alt || null, id],
    );

    await logAudit({
      action: "update",
      entity: "category",
      entityId: id,
      before: existing[0],
      after: rows[0],
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json(rows[0]);
  },
  { permissions: ["products.edit"] },
);

export const DELETE = withAuth(
  async ({ params, staff }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Unknown category." }, { status: 404 });
    }

    const existing = await query("SELECT * FROM categories WHERE id = $1", [id]);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Unknown category." }, { status: 404 });
    }

    /* Products keep existing with category_id set to NULL, so this is safe. */
    const rows = await query("DELETE FROM categories WHERE id = $1 RETURNING id", [id]);

    // The picture belonged to the row that just went; drop its bytes too.
    await removeStoredFiles([(existing[0] as { image_url?: string | null }).image_url ?? null]);

    revalidateTaxonomy();

    await logAudit({
      action: "delete",
      entity: "category",
      entityId: id,
      before: existing[0],
      after: rows[0],
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json({ ok: true, id });
  },
  { permissions: ["products.edit"] },
);

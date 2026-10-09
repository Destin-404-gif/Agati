import { NextResponse } from "next/server";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { revalidateTaxonomy } from "@/lib/revalidate";
import { subcategoryInput } from "../categories/_shared";

export const dynamic = "force-dynamic";

/**
 * Second-level taxonomy: bedroom > mirrors, and every other label the shop
 * pages already link to.
 *
 * The storefront taxonomy lives in `src/lib/navigation.ts` and this table is
 * keyed to match it by `(category slug, subcategory slug)`, so a row here is
 * what gives an existing navigation tile its picture.
 */

export interface SubcategoryRow {
  id: number;
  category_id: number;
  category_slug: string;
  category_name: string;
  name: string;
  slug: string;
  image_url: string | null;
  image_alt: string | null;
  position: number;
  created_at: string;
}

export const GET = withAuth(async ({ req }) => {
  const url = new URL(req.url);
  const categorySlug = url.searchParams.get("category");
  const search = url.searchParams.get("q")?.trim();

  const where: string[] = [];
  const args: unknown[] = [];

  if (categorySlug) {
    args.push(categorySlug);
    where.push(`c.slug = $${args.length}`);
  }
  if (search) {
    args.push(`%${search.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
    const i = args.length;
    where.push(`(s.name ILIKE $${i} OR s.slug ILIKE $${i})`);
  }

  const rows = await query<SubcategoryRow>(
    `SELECT s.id, s.category_id, c.slug AS category_slug, c.name AS category_name,
            s.name, s.slug, s.image_url, s.image_alt, s.position, s.created_at
       FROM subcategories s
       JOIN categories c ON c.id = s.category_id
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY c.name ASC, s.position ASC, s.name ASC`,
    args,
  );

  return NextResponse.json({ rows, total: rows.length });
});

export const POST = withAuth(
  async ({ req, staff }) => {
    const parsed = subcategoryInput.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Check the fields." },
        { status: 400 },
      );
    }

    const { categoryId, name, slug, image_url, image_alt, position } = parsed.data;

    const parent = await query<{ id: number }>(
      "SELECT id FROM categories WHERE id = $1",
      [categoryId],
    );
    if (parent.length === 0) {
      return NextResponse.json(
        { error: "That parent category no longer exists.", fields: { categoryId: "Unknown category." } },
        { status: 400 },
      );
    }

    const cleanSlug = slug.trim().toLowerCase();
    const clash = await query(
      "SELECT id FROM subcategories WHERE category_id = $1 AND slug = $2",
      [categoryId, cleanSlug],
    );
    if (clash.length > 0) {
      return NextResponse.json(
        { error: "That slug is already used under this category." },
        { status: 409 },
      );
    }

    const rows = await query<{ id: number }>(
      `INSERT INTO subcategories
         (category_id, name, slug, image_url, image_alt, position)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING id, category_id, name, slug, image_url, image_alt, position`,
      [categoryId, name.trim(), cleanSlug, image_url || null, image_alt || null, position],
    );

    await logAudit({
      action: "create",
      entity: "subcategory",
      entityId: rows[0].id,
      after: rows[0],
      staff: { id: staff.id, email: staff.email },
    });

    revalidateTaxonomy();

    return NextResponse.json(rows[0], { status: 201 });
  },
  { permissions: ["products.edit"] },
);
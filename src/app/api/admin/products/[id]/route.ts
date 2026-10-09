import { NextResponse } from "next/server";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { fieldErrors, productSchema, slugify } from "@/lib/admin-schemas";
import { getPool, query } from "@/lib/db";
import { replaceProductImages, replaceProductPlacements, slugIsTaken, uniqueSlug, validateProductCategory, validateProductPlacements } from "../_shared";
import { revalidateNavigation } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

export const GET = withAuth(async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Unknown product." }, { status: 404 });
  }

  const rows = await query(
    `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
      WHERE p.id = $1`,
    [id],
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Unknown product." }, { status: 404 });
  }

  const product = rows[0] as Record<string, unknown>;

  const [images, variants, placements] = await Promise.all([
    query(
      "SELECT id, image_url, position FROM product_images WHERE product_id = $1 ORDER BY position, id",
      [id],
    ),
    query(
      "SELECT id, variant_name, color, price_modifier, image_url FROM product_variants WHERE product_id = $1 ORDER BY id",
      [id],
    ),
    query(
      `SELECT pp.nav_item_id, n.navbar, pp.mega_section_id
         FROM product_placements pp
         JOIN nav_items n ON n.id = pp.nav_item_id
        WHERE pp.product_id = $1 ORDER BY pp.id`,
      [id],
    ),
  ]);

  return NextResponse.json({
    ...product,
    status: product.status ?? "active",
    images,
    variants,
    placements,
  });
});

export const PUT = withAuth(
  async ({ req, params, staff }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Unknown product." }, { status: 404 });
    }

    const body = productSchema.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json(
        { error: "Please check the highlighted fields.", fields: fieldErrors(body.error) },
        { status: 400 },
      );
    }

    const data = body.data;
    const categoryError = await validateProductCategory(data.categoryId, data.subcategoryId);
    if (categoryError) {
      return NextResponse.json(
        { error: categoryError, fields: { categoryId: categoryError } },
        { status: 400 },
      );
    }
    if (data.placements) {
      const placementError = await validateProductPlacements(data.placements);
      if (placementError) {
        return NextResponse.json({ error: placementError, fields: { placements: placementError } }, { status: 400 });
      }
    }

    const existing = await query("SELECT * FROM products WHERE id = $1", [id]);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Unknown product." }, { status: 404 });
    }
    const before = existing[0] as Record<string, unknown>;

    const typedSlug = data.slug ? slugify(data.slug) : "";
    const requested = typedSlug || slugify(data.name);
    const currentSlug = before.slug as string;

    // Keep the existing slug when nothing relevant changed, uniquify a
    // generated one, and reject a hand-typed collision so links never move
    // without the user knowing.
    let slug = currentSlug;
    if (requested && requested !== currentSlug) {
      if (typedSlug) {
        if (await slugIsTaken(requested, id)) {
          return NextResponse.json(
            { error: "That slug is already in use.", fields: { slug: "Already in use." } },
            { status: 400 },
          );
        }
        slug = requested;
      } else {
        slug = await uniqueSlug(requested, id);
      }
    }

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");

      const { rows } = await client.query(
        `UPDATE products SET
           name = $1, slug = $2, description = $3, price = $4,
           category_id = $5, subcategory_id = $6, is_new = $7, is_featured = $8,
           stock_quantity = $9, status = $10
         WHERE id = $11 RETURNING *`,
        [
          data.name,
          slug,
          data.description || null,
          data.price,
          data.categoryId,
          data.subcategoryId,
          data.isNew,
          data.isFeatured,
          data.stockQuantity,
          data.status,
          id,
        ],
      );

      await replaceProductImages(client, id, data.images);
      if (data.placements) await replaceProductPlacements(client, id, data.placements);
      await client.query("COMMIT");

      await logAudit({
        action: "update",
        entity: "product",
        entityId: id,
        before,
        after: rows[0],
        staff: { id: staff.id, email: staff.email },
      });

      revalidateNavigation();

      return NextResponse.json({ ok: true, id, slug });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },
  { permissions: ["products.edit"] },
);

export const DELETE = withAuth(
  async ({ params, staff }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Unknown product." }, { status: 404 });
    }

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");

      const before = await client.query(
        "SELECT id, name, slug FROM products WHERE id = $1",
        [id],
      );

      if (before.rowCount === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "Unknown product." }, { status: 404 });
      }

      // Preserve order history: order_items.product_id is nullable.
      await client.query(
        "UPDATE order_items SET product_id = NULL WHERE product_id = $1",
        [id],
      );
      const deleted = await client.query(
        "DELETE FROM products WHERE id = $1 RETURNING id",
        [id],
      );

      await client.query("COMMIT");

      await logAudit({
        action: "delete",
        entity: "product",
        entityId: id,
        before: before.rows[0],
        staff: { id: staff.id, email: staff.email },
      });

      revalidateNavigation();

      return NextResponse.json({ ok: true, deleted: deleted.rowCount });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },
  { permissions: ["products.edit"] },
);

import { NextResponse } from "next/server";
import { z } from "zod";
import { csvResponse, toCsv, withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { getAllProductsForExport, listProducts, parseListParams } from "@/lib/admin-list";
import { getPool } from "@/lib/db";
import { fieldErrors, productSchema, slugify } from "@/lib/admin-schemas";
import { PRODUCT_STATUSES } from "@/lib/admin-nav";
import { revalidateNavigation } from "@/lib/revalidate";
import { replaceProductPlacements, slugIsTaken, uniqueSlug, validateProductCategory, validateProductPlacements, withProductImages } from "./_shared";

export const dynamic = "force-dynamic";

const BulkBody = z.object({
  action: z.enum(["delete", "status"]),
  ids: z.array(z.number().int().positive()).min(1).max(500),
  value: z.string().optional(),
});

/** List, CSV export, create and bulk actions. */
export const GET = withAuth(async ({ req, staff }) => {
  const url = new URL(req.url);

  if (url.searchParams.get("format") === "csv") {
    const rows = await getAllProductsForExport();
    const csv = toCsv(
      [
        "id",
        "name",
        "slug",
        "price",
        "status",
        "category_name",
        "stock_quantity",
        "is_new",
        "is_featured",
        "image_count",
        "variant_count",
        "created_at",
      ],
      rows as unknown as Record<string, unknown>[],
    );

    await logAudit({
      action: "export",
      entity: "product",
      after: { rows: rows.length },
      staff: { id: staff.id, email: staff.email },
    });

    return csvResponse(`agati-products-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  const params = parseListParams(url.searchParams);
  const result = await listProducts(params);

  return NextResponse.json({
    rows: result.rows,
    total: result.total,
    page: result.page,
    perPage: result.perPage,
    pageCount: result.pageCount,
  });
});

export const POST = withAuth(
  async ({ req, staff }) => {
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
    const typedSlug = data.slug ? slugify(data.slug) : "";
    const requested = typedSlug || slugify(data.name);

    if (!requested) {
      return NextResponse.json(
        { error: "Could not work out a URL slug from that name.", fields: { slug: "Add a slug." } },
        { status: 400 },
      );
    }

    // A slug generated from the name gets a numeric suffix when it clashes;
    // a slug the user typed by hand must stay exactly as typed, so a clash
    // is reported instead of silently changing the URL.
    const slug = typedSlug
      ? requested
      : await uniqueSlug(requested);

    if (typedSlug && (await slugIsTaken(slug))) {
      return NextResponse.json(
        { error: "That slug is already in use.", fields: { slug: "Already in use." } },
        { status: 400 },
      );
    }

    const result = await withProductImages(async (client) => {
      const { rows } = await client.query(
        `INSERT INTO products
           (name, slug, description, price, category_id, subcategory_id, is_new, is_featured, stock_quantity, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         RETURNING *`,
        [
          data.name,
          slug,
          data.description || null,
          data.price,
          data.categoryId ?? null,
          data.subcategoryId ?? null,
          data.isNew,
          data.isFeatured,
          data.stockQuantity,
          data.status,
        ],
      );
      const product = rows[0] as { id: number };
      if (data.placements) await replaceProductPlacements(client, product.id, data.placements);
      return product;
    }, data.images);

    await logAudit({
      action: "create",
      entity: "product",
      entityId: result.id,
      after: { ...data, slug, images: data.images.length },
      staff: { id: staff.id, email: staff.email },
    });

    revalidateNavigation();

    return NextResponse.json({ ok: true, id: result.id, slug }, { status: 201 });
  },
  { permissions: ["products.edit"] },
);

/** Bulk delete or bulk status change. */
export const PATCH = withAuth(
  async ({ req, staff }) => {
    const parsed = BulkBody.safeParse(await req.json().catch(() => ({})));

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid bulk request." }, { status: 400 });
    }

    const { action, ids, value } = parsed.data;
    const client = await getPool().connect();

    try {
      await client.query("BEGIN");

      if (action === "status") {
        const status = PRODUCT_STATUSES.find((s) => s === value);
        if (!status) {
          await client.query("ROLLBACK");
          return NextResponse.json({ error: "Unknown status." }, { status: 400 });
        }

        const { rows: before } = await client.query(
          "SELECT id, status FROM products WHERE id = ANY($1::int[])",
          [ids],
        );
        await client.query(
          "UPDATE products SET status = $1 WHERE id = ANY($2::int[])",
          [status, ids],
        );

        await client.query("COMMIT");
        await logAudit({
          action: "status",
          entity: "product",
          after: { ids, status, previous: before },
          staff: { id: staff.id, email: staff.email },
        });

        revalidateNavigation();

        return NextResponse.json({ ok: true, affected: ids.length });
      }

      const { rows: before } = await client.query(
        "SELECT id, name, slug FROM products WHERE id = ANY($1::int[])",
        [ids],
      );
      // product_images and product_variants cascade; order_items keep their
      // product_id and would break, so those rows are detached first.
      await client.query(
        "UPDATE order_items SET product_id = NULL WHERE product_id = ANY($1::int[])",
        [ids],
      );
      const deleted = await client.query(
        "DELETE FROM products WHERE id = ANY($1::int[])",
        [ids],
      );

      await client.query("COMMIT");

      await logAudit({
        action: "delete",
        entity: "product",
        before: { rows: before },
        staff: { id: staff.id, email: staff.email },
      });

      revalidateNavigation();

      return NextResponse.json({ ok: true, affected: deleted.rowCount ?? 0 });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },
  { permissions: ["products.edit"] },
);

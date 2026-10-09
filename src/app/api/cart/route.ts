import { badRequest, handleDbError, json, positiveInt } from "@/lib/api";
import { query, withTransaction } from "@/lib/db";
import { getCart } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** GET /api/cart?user_id=1 - hydrate the client's cart on load. */
export async function GET(request: Request) {
  try {
    const userId = positiveInt(new URL(request.url).searchParams.get("user_id"), 0);
    if (!userId) return badRequest("user_id is required");

    const items = await getCart(userId);
    const total = items.reduce((sum, l) => sum + Number(l.line_total), 0);
    return json({ items, total: total.toFixed(2), count: items.length });
  } catch (err) {
    return handleDbError(err);
  }
}

/**
 * POST /api/cart
 * body: { user_id, product_id, variant_id?, quantity? }
 * Adds to the cart, merging with any existing row for the same product+variant.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<
      string,
      unknown
    > | null;
    if (!body) return badRequest("Request body must be valid JSON");

    const userId = positiveInt(body.user_id, 0);
    const productId = positiveInt(body.product_id, 0);
    const variantId = body.variant_id ? positiveInt(body.variant_id, 0) : null;
    const quantity = positiveInt(body.quantity, 1);

    if (!userId) return badRequest("user_id is required");
    if (!productId) return badRequest("product_id is required");

    await withTransaction(async (client) => {
      // The variant must belong to the product, and stock must cover the add.
      const [product] = (
        await client.query(
          `SELECT id, stock_quantity FROM products WHERE id = $1 FOR UPDATE`,
          [productId],
        )
      ).rows as { id: number; stock_quantity: number }[];

      if (!product) throw Object.assign(new Error("Product not found"), { code: "P404" });

      if (variantId) {
        const [variant] = (
          await client.query(
            `SELECT id FROM product_variants WHERE id = $1 AND product_id = $2`,
            [variantId, productId],
          )
        ).rows as { id: number }[];

        if (!variant) throw Object.assign(new Error("Variant not found"), { code: "P404" });
      }

      const [existing] = (
        await client.query(
          `SELECT id, quantity FROM cart_items
           WHERE user_id = $1 AND product_id = $2
             AND variant_id IS NOT DISTINCT FROM $3
           FOR UPDATE`,
          [userId, productId, variantId],
        )
      ).rows as { id: number; quantity: number }[];

      const nextQty = (existing?.quantity ?? 0) + quantity;
      if (nextQty > product.stock_quantity) {
        throw Object.assign(
          new Error(`Only ${product.stock_quantity} in stock for this item`),
          { code: "P409" },
        );
      }

      if (existing) {
        await client.query(`UPDATE cart_items SET quantity = $1 WHERE id = $2`, [
          nextQty,
          existing.id,
        ]);
      } else {
        await client.query(
          `INSERT INTO cart_items (user_id, product_id, variant_id, quantity)
           VALUES ($1, $2, $3, $4)`,
          [userId, productId, variantId, quantity],
        );
      }
    });

    const items = await getCart(userId);
    const total = items.reduce((sum, l) => sum + Number(l.line_total), 0);
    return json({ items, total: total.toFixed(2), count: items.length }, 201);
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "P404") return badRequest((err as Error).message);
    if (code === "P409") return badRequest((err as Error).message, { stock: true });
    return handleDbError(err);
  }
}

/** DELETE /api/cart - empty the cart for a user. body: { user_id } */
export async function DELETE(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as {
      user_id?: unknown;
    } | null;
    const userId = positiveInt(body?.user_id, 0);
    if (!userId) return badRequest("user_id is required");

    const rows = await query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);
    return json({ removed: rows.length });
  } catch (err) {
    return handleDbError(err);
  }
}

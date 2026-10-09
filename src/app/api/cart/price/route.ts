import { badRequest, handleDbError, json } from "@/lib/api";
import { getPool } from "@/lib/db";
import { normalizeRequestedLines, priceLines, PricingError } from "@/lib/pricing";

export const dynamic = "force-dynamic";

/**
 * POST /api/cart/price
 *
 * body: { items: [{ product_id, variant_id?, quantity }] }
 *
 * The browser stores only ids and quantities; every figure the customer sees in
 * the cart and at checkout comes from here. Prices, names and stock are read
 * from the database on every call, so a stale or hand-edited cart cannot invent
 * a total. Read-only: no stock is locked and nothing is decremented - that
 * happens once, transactionally, when the order is placed.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return badRequest("Request body must be valid JSON");

    const lines = normalizeRequestedLines(body.items);
    if (lines.length === 0) {
      return json({ lines: [], subtotal: "0.00", count: 0 });
    }

    const client = await getPool().connect();
    try {
      const cart = await priceLines(client, lines, { enforceStock: true });

      return json({
        lines: cart.lines.map((line) => ({
          product_id: line.product_id,
          variant_id: line.variant_id,
          slug: line.slug,
          name: line.product_name,
          variant_name: line.variant_name,
          image_url: line.image_url,
          quantity: line.quantity,
          unit_price: line.unit_price.toFixed(2),
          line_total: line.line_total.toFixed(2),
        })),
        subtotal: cart.subtotal.toFixed(2),
        count: cart.lines.reduce((sum, l) => sum + l.quantity, 0),
      });
    } finally {
      client.release();
    }
  } catch (err) {
    if (err instanceof PricingError) {
      return badRequest(err.message, err.fields);
    }
    return handleDbError(err);
  }
}
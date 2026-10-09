import { badRequest, handleDbError, json } from "@/lib/api";
import { validateCheckout, type CheckoutPayload } from "@/lib/checkout";
import { withTransaction, type PoolClient } from "@/lib/db";
import { normalizeRwandanPhone } from "@/lib/phone";
import { normalizeRequestedLines, priceLines, PricingError, type PricedLine } from "@/lib/pricing";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders
 *
 * Two shapes, both ending in the same transaction:
 *
 *   1. Storefront checkout - `{ customer, delivery, payment_method, items }`
 *      Creates or finds the customer, writes a readable order number, snapshots
 *      the price of every line and leaves the order `pending` for the workshop
 *      to confirm over WhatsApp.
 *
 *   2. Demo account - `{ user_id, items }` or `{ user_id, from_cart: true }`
 *      Used by the seeded demo user and the verification script.
 *
 * In both cases the client sends only ids and quantities: totals and
 * `price_modifier`s are recomputed from the database inside a transaction, with
 * the product rows locked before stock is checked and decremented.
 */

/** `AGT-00001`, derived from the order id so it is unique and never reused. */
async function assignOrderNumber(client: PoolClient, orderId: number): Promise<string> {
  const { rows } = await client.query(
    `UPDATE orders
        SET order_number = 'AGT-' || LPAD($1::text, 5, '0')
      WHERE id = $1
      RETURNING order_number`,
    [orderId],
  );
  return rows[0].order_number as string;
}

/** Guest records have no password; this is never a real credential. */
const GUEST_HASH = "guest-account-no-login";

/**
 * Find or create the customer behind an order.
 *
 * With an email we key on it. Without one we key on the phone number, so a
 * guest who orders twice ends up with one customer record rather than two, and
 * staff can still look the order history up by the number they were called on.
 */
async function upsertCustomer(
  client: PoolClient,
  customer: CheckoutPayload["customer"],
  address: string,
): Promise<number> {
  const email = customer.email?.toLowerCase() ?? null;

  const key = email
    ? { column: "lower(email)", value: email }
    : { column: "phone", value: customer.phone };

  const [existing] = (
    await client.query(
      `SELECT id FROM users WHERE ${key.column} = $1 FOR UPDATE`,
      [key.value],
    )
  ).rows as { id: number }[];

  if (existing) {
    await client.query(
      `UPDATE users
          SET full_name = $2,
              phone = COALESCE($3, phone),
              address = COALESCE($4, address)
        WHERE id = $1`,
      [existing.id, customer.full_name, customer.phone, address],
    );
    return existing.id;
  }

  const [created] = (
    await client.query(
      `INSERT INTO users (email, password_hash, full_name, phone, address)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        email ?? `${customer.phone}@guest.agati.local`,
        GUEST_HASH,
        customer.full_name,
        customer.phone,
        address,
      ],
    )
  ).rows as { id: number }[];

  return created.id;
}

/** Persist the order and its lines, decrementing stock as we go. */
async function insertOrder(
  client: PoolClient,
  options: {
    userId: number | null;
    lines: PricedLine[];
    subtotal: number;
    customer?: CheckoutPayload["customer"];
    delivery?: CheckoutPayload["delivery"];
    paymentMethod?: string;
  },
) {
  const { lines, subtotal } = options;

  // Store one canonical spelling of the number, so searching the admin list by
  // phone matches no matter how the customer typed it (+250784088929, 078 4088929,
  // 250784088929 all land on the same string).
  const phone = options.customer?.phone
    ? normalizeRwandanPhone(options.customer.phone)
    : null;

  const { rows: orderRows } = await client.query(
    `INSERT INTO orders
       (user_id, status, total, customer_name, customer_phone, customer_email,
        delivery_district, delivery_sector, delivery_landmark, delivery_note,
        payment_method)
     VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, order_number, user_id, status, total, created_at`,
    [
      options.userId,
      subtotal.toFixed(2),
      options.customer?.full_name ?? null,
      phone,
      options.customer?.email ?? null,
      options.delivery?.district ?? null,
      options.delivery?.sector ?? null,
      options.delivery?.landmark ?? null,
      options.delivery?.note ?? null,
      options.paymentMethod ?? null,
    ],
  );
  const order = orderRows[0] as { id: number; order_number: string | null };

  for (const line of lines) {
    await client.query(
      `INSERT INTO order_items
         (order_id, product_id, variant_id, product_name, quantity, unit_price)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        order.id,
        line.product_id,
        line.variant_id,
        line.product_name,
        line.quantity,
        line.unit_price.toFixed(2),
      ],
    );
    await client.query(
      `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
      [line.quantity, line.product_id],
    );
  }

  if (!order.order_number) {
    order.order_number = await assignOrderNumber(client, order.id);
  }

  return order;
}

const itemPayload = (lines: PricedLine[]) =>
  lines.map((l) => ({
    product_id: l.product_id,
    variant_id: l.variant_id,
    name: l.product_name,
    variant_name: l.variant_name,
    quantity: l.quantity,
    unit_price: l.unit_price.toFixed(2),
    line_total: l.line_total.toFixed(2),
  }));

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return badRequest("Request body must be valid JSON");

    /* ------------------------------------------------- storefront checkout */
    if (body.customer !== undefined || body.payment_method !== undefined) {
      const check = validateCheckout(body);
      if (!check.ok) {
        return badRequest("Please check the highlighted fields", check.fields);
      }

      const { customer, delivery, payment_method, items } = check.data;
      const requested = normalizeRequestedLines(items);
      if (requested.length === 0) return badRequest("Your cart is empty");

      const { order, lines } = await withTransaction(async (client) => {
        const cart = await priceLines(client, requested, { lock: true, enforceStock: true });

        const userId = await upsertCustomer(
          client,
          customer,
          `${delivery.district}, ${delivery.sector}, ${delivery.landmark}`,
        );

        const created = await insertOrder(client, {
          userId,
          lines: cart.lines,
          subtotal: cart.subtotal,
          customer,
          delivery,
          paymentMethod: payment_method,
        });

        return { order: created, lines: cart.lines };
      });

      return json({ order, items: itemPayload(lines) }, 201);
    }

    /* ------------------------------------------------------- demo account */
    const userId = Number(body.user_id);
    if (!Number.isInteger(userId) || userId < 1) return badRequest("user_id is required");

    const clearCart = body.clear_cart !== false;
    const requested = body.from_cart
      ? (
          await withTransaction(
            async (client) =>
              (
                await client.query(
                  `SELECT product_id, variant_id, quantity FROM cart_items
                    WHERE user_id = $1 ORDER BY id ASC`,
                  [userId],
                )
              ).rows as { product_id: number; variant_id: number | null; quantity: number }[],
          )
        ).map((row) => ({
          product_id: row.product_id,
          variant_id: row.variant_id,
          quantity: Math.max(1, row.quantity),
        }))
      : normalizeRequestedLines(body.items);

    if (requested.length === 0) return badRequest("Order has no items");

    const result = await withTransaction(async (client) => {
      const cart = await priceLines(client, requested, { lock: true, enforceStock: true });
      const order = await insertOrder(client, {
        userId,
        lines: cart.lines,
        subtotal: cart.subtotal,
      });

      if (clearCart) {
        await client.query(`DELETE FROM cart_items WHERE user_id = $1`, [userId]);
      }

      return { order, lines: cart.lines };
    });

    return json({ order: result.order, items: itemPayload(result.lines) }, 201);
  } catch (err) {
    if (err instanceof PricingError) return badRequest(err.message, err.fields);
    return handleDbError(err);
  }
}
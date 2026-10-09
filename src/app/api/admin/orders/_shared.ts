import type { OrderRow } from "@/lib/admin-list";
import { getPool } from "@/lib/db";

/** Order helpers shared by the collection route and the [id] route. */

export interface OrderItemRow {
  id: number;
  product_id: number | null;
  product_name: string | null;
  product_slug: string | null;
  product_image: string | null;
  variant_id: number | null;
  variant_name: string | null;
  quantity: number;
  unit_price: string;
  line_total: string;
}

export interface OrderDetail extends OrderRow {
  items: OrderItemRow[];
  /** Name/price of a product that was deleted after the order was placed. */
  missing_items: number;
  /** The customer's own words from the checkout form. */
  delivery_note?: string | null;
}

const ORDER_ITEMS_SQL = `
  SELECT oi.id,
         oi.product_id,
         COALESCE(oi.product_name, p.name) AS product_name,
         p.slug  AS product_slug,
         pi.image_url AS product_image,
         oi.variant_id,
         pv.variant_name,
         oi.quantity,
         oi.unit_price,
         (oi.unit_price * oi.quantity)::numeric(10,2) AS line_total
    FROM order_items oi
    LEFT JOIN products p ON p.id = oi.product_id
    LEFT JOIN product_images pi
           ON pi.id = (SELECT id FROM product_images
                        WHERE product_id = oi.product_id
                        ORDER BY position, id LIMIT 1)
    LEFT JOIN product_variants pv ON pv.id = oi.variant_id
   WHERE oi.order_id = $1
   ORDER BY oi.id`;

/** Loads one order with its line items. */
export async function getOrderDetail(id: number): Promise<OrderDetail | null> {
  const pool = getPool();

  // `o.*` carries the checkout copies of name and email; the COALESCE keeps
  // those and only falls back to the account row for orders placed before the
  // checkout columns existed.
  const { rows } = await pool.query(
    `SELECT o.*,
            COALESCE(o.customer_name, u.full_name) AS customer_name,
            COALESCE(o.customer_email, u.email)    AS customer_email,
            (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id)::int
              AS item_count
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
      WHERE o.id = $1`,
    [id],
  );

  if (rows.length === 0) return null;

  const { rows: items } = await pool.query(ORDER_ITEMS_SQL, [id]);
  const order = rows[0] as OrderDetail;
  order.items = items as OrderItemRow[];
  order.missing_items = order.items.filter((i) => !i.product_id).length;

  return order;
}

/** Flat export rows for `?format=csv`. */
export async function getAllOrdersForExport(): Promise<Record<string, unknown>[]> {
  const { rows } = await getPool().query(
    `SELECT o.id,
            o.order_number,
            o.created_at,
            o.status,
            o.total,
            (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id)::int
              AS item_count,
            COALESCE(o.customer_name, u.full_name) AS customer_name,
            COALESCE(o.customer_email, u.email)    AS customer_email,
            o.customer_phone,
            o.delivery_district,
            o.delivery_sector,
            o.delivery_landmark,
            o.payment_method,
            o.notes
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
      ORDER BY o.created_at DESC, o.id DESC`,
  );
  return rows;
}

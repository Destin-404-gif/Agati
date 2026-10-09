import { query, getPool } from "@/lib/db";
import type { CustomerRow } from "@/lib/admin-list";

/** Customer helpers shared by the collection route and the [id] route. */

export interface CustomerOrderRow {
  id: number;
  status: string;
  total: string;
  created_at: string;
  item_count: number;
}

export interface CustomerDetail extends CustomerRow {
  orders: CustomerOrderRow[];
}

export async function getCustomerDetail(
  id: number,
): Promise<CustomerDetail | null> {
  const rows = await query<CustomerRow>(
    `SELECT u.id, u.email, u.full_name, u.created_at,
            (SELECT COUNT(*)::int FROM orders o WHERE o.user_id = u.id) AS order_count,
            (SELECT COALESCE(SUM(o.total), 0)::numeric(10,2) FROM orders o
              WHERE o.user_id = u.id AND o.status <> 'cancelled') AS lifetime_value,
            (SELECT MAX(created_at) FROM orders o WHERE o.user_id = u.id) AS last_order_at
       FROM users u
      WHERE u.id = $1`,
    [id],
  );

  if (rows.length === 0) return null;

  const customer = rows[0] as CustomerDetail;
  customer.orders = await listCustomerOrders(id);
  return customer;
}

export async function listCustomerOrders(
  customerId: number,
): Promise<CustomerOrderRow[]> {
  const rows = await query<CustomerOrderRow>(
    `SELECT o.id, o.status, o.total, o.created_at,
            (SELECT COALESCE(SUM(quantity),0)::int FROM order_items oi WHERE oi.order_id = o.id)
              AS item_count
       FROM orders o
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC, o.id DESC`,
    [customerId],
  );
  return rows;
}

export async function getAllCustomersForExport(): Promise<Record<string, unknown>[]> {
  const { rows } = await getPool().query(
    `SELECT u.id, u.full_name, u.email, u.created_at,
            (SELECT COUNT(*)::int FROM orders o WHERE o.user_id = u.id) AS order_count,
            (SELECT COALESCE(SUM(o.total),0)::numeric(10,2) FROM orders o
              WHERE o.user_id = u.id AND o.status <> 'cancelled') AS lifetime_value,
            (SELECT MAX(created_at) FROM orders o WHERE o.user_id = u.id) AS last_order_at
       FROM users u
      ORDER BY u.created_at DESC, u.id DESC`,
  );
  return rows;
}

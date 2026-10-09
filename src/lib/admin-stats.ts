import { query, type QueryResultRow } from "./db";

/**
 * Aggregate reads for the admin dashboard and reports. All in one place so the
 * KPI definitions stay consistent between the page and the JSON endpoint.
 */

const MONEY = "COALESCE(SUM(total), 0)";

export interface Kpis {
  products: number;
  activeProducts: number;
  orders: number;
  openOrders: number;
  customers: number;
  newCustomers: number;
  quotes: number;
  newQuotes: number;
  revenue: number;
  revenueOpen: number;
  lowStock: number;
  averageOrder: number;
  staff: number;
}

export async function getKpis(): Promise<Kpis> {
  const rows = await query(
    `SELECT
       (SELECT COUNT(*)::int FROM products) AS products,
       (SELECT COUNT(*)::int FROM products WHERE COALESCE(status,'active') = 'active') AS active_products,
       (SELECT COUNT(*)::int FROM orders) AS orders,
       (SELECT COUNT(*)::int FROM orders WHERE status IN ('pending','processing')) AS open_orders,
       (SELECT COUNT(*)::int FROM users) AS customers,
       (SELECT COUNT(*)::int FROM users WHERE created_at > NOW() - INTERVAL '30 days') AS new_customers,
       (SELECT COUNT(*)::int FROM quote_requests) AS quotes,
       (SELECT COUNT(*)::int FROM quote_requests WHERE status = 'new') AS new_quotes,
       (SELECT ${MONEY} FROM orders WHERE status <> 'cancelled') AS revenue,
       (SELECT ${MONEY} FROM orders WHERE status IN ('pending','processing')) AS revenue_open,
       (SELECT COALESCE(AVG(total), 0) FROM orders WHERE status <> 'cancelled') AS average_order,
       (SELECT COUNT(*)::int FROM products WHERE stock_quantity <= 3 AND COALESCE(status,'active') = 'active') AS low_stock,
       (SELECT COUNT(*)::int FROM staff_users WHERE is_active) AS staff`,
  );

  const r = rows[0] as Record<string, number | string>;
  return {
    products: Number(r.products),
    activeProducts: Number(r.active_products),
    orders: Number(r.orders),
    openOrders: Number(r.open_orders),
    customers: Number(r.customers),
    newCustomers: Number(r.new_customers),
    quotes: Number(r.quotes),
    newQuotes: Number(r.new_quotes),
    revenue: Number(r.revenue),
    revenueOpen: Number(r.revenue_open),
    averageOrder: Number(r.average_order),
    lowStock: Number(r.low_stock),
    staff: Number(r.staff),
  };
}

/** Orders created per day for the last `days` days. */
export async function getOrderTrend(days = 30) {
  const rows = await query<QueryResultRow & { day: string; orders: string; revenue: string }>(
    `SELECT
       TO_CHAR(d.day, 'DD Mon') AS day,
       COALESCE(COUNT(o.id), 0)::text AS orders,
       COALESCE(SUM(o.total), 0)::text AS revenue
     FROM generate_series(
       CURRENT_DATE - ($1::int - 1), CURRENT_DATE, INTERVAL '1 day'
     ) AS d(day)
     LEFT JOIN orders o
       ON DATE(o.created_at) = d.day AND o.status <> 'cancelled'
     GROUP BY d.day
     ORDER BY d.day`,
    [days],
  );

  return rows.map((r) => ({
    label: r.day,
    value: Number(r.orders),
    revenue: Number(r.revenue),
  }));
}

export async function getTopCategories(limit = 6) {
  return query<{ name: string; products: string; revenue: string }>(
    `SELECT
       COALESCE(c.name, 'Uncategorised') AS name,
       COUNT(DISTINCT p.id)::text          AS products,
       COALESCE(SUM(oi.quantity * oi.unit_price), 0)::text AS revenue
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id
     LEFT JOIN order_items oi ON oi.product_id = p.id
     LEFT JOIN orders o ON o.id = oi.order_id AND o.status <> 'cancelled'
     GROUP BY c.id, c.name
     ORDER BY COUNT(DISTINCT p.id) DESC, c.name
     LIMIT $1`,
    [limit],
  );
}

export async function getOrderStatusBreakdown() {
  return query<{ status: string; count: string }>(
    `SELECT COALESCE(status, 'unknown') AS status, COUNT(*)::text AS count
       FROM orders GROUP BY 1 ORDER BY 2 DESC`,
  );
}

export async function getQuoteStatusBreakdown() {
  return query<{ status: string; count: string }>(
    `SELECT COALESCE(status, 'new') AS status, COUNT(*)::text AS count
       FROM quote_requests GROUP BY 1 ORDER BY 2 DESC`,
  );
}

export interface AuditEntry {
  id: number;
  action: string;
  entity: string | null;
  entityId: string | null;
  staffEmail: string | null;
  createdAt: string;
}

export async function getRecentActivity(limit = 12): Promise<AuditEntry[]> {
  const rows = await query<{
    id: number;
    action: string;
    entity: string | null;
    entity_id: string | null;
    staff_email: string | null;
    created_at: string;
  }>(
    `SELECT id, action, entity, entity_id, staff_email, created_at
       FROM audit_logs
      ORDER BY created_at DESC, id DESC
      LIMIT $1`,
    [limit],
  );

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entityId: r.entity_id,
    staffEmail: r.staff_email,
    createdAt: r.created_at,
  }));
}

export interface DashboardPayload {
  kpis: Kpis;
  trend: { label: string; value: number; revenue: number }[];
  topCategories: { name: string; products: number; revenue: number }[];
  orderStatuses: { label: string; value: number }[];
  quoteStatuses: { label: string; value: number }[];
  activity: AuditEntry[];
  revenueSeries: { label: string; value: number }[];
}

/** One round trip for the whole dashboard. */
export async function getDashboard(days = 30): Promise<DashboardPayload> {
  const [kpis, trend, topCategories, orderStatuses, quoteStatuses, activity] =
    await Promise.all([
      getKpis(),
      getOrderTrend(days),
      getTopCategories(),
      getOrderStatusBreakdown(),
      getQuoteStatusBreakdown(),
      getRecentActivity(),
    ]);

  return {
    kpis,
    trend,
    topCategories: topCategories.map((r) => ({
      name: r.name,
      products: Number(r.products),
      revenue: Number(r.revenue),
    })),
    orderStatuses: orderStatuses.map((r) => ({
      label: r.status,
      value: Number(r.count),
    })),
    quoteStatuses: quoteStatuses.map((r) => ({
      label: r.status,
      value: Number(r.count),
    })),
    activity,
    revenueSeries: trend.map((t) => ({ label: t.label, value: t.revenue })),
  };
}

/* ------------------------------------------------------------------ reports */

export interface ReportsPayload {
  window: { days: number; from: string; to: string };
  totals: {
    orders: number;
    revenue: number;
    units: number;
    average_order: number;
    customers: number;
    new_customers: number;
    quotes: number;
    quote_conversion: number;
  };
  revenueByDay: { label: string; value: number }[];
  topProducts: {
    name: string;
    units: number;
    revenue: number;
    stock: number;
  }[];
  revenueByCategory: { name: string; revenue: number; units: number }[];
  topCustomers: { name: string; email: string; orders: number; revenue: number }[];
  lowStock: { name: string; stock: number; sku: string | null }[];  quoteFunnel: { label: string; value: number }[];
}

/**
 * Sales reporting over a window. Revenue excludes cancelled orders, matching
 * the KPI definition used on the dashboard.
 */
export async function getReports(days = 30): Promise<ReportsPayload> {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  const [totals, revenueByDay, topProducts, revenueByCategory, topCustomers, lowStock, quoteFunnel] =
    await Promise.all([
      query<{
        orders: string;
        revenue: string;
        units: string;
        average_order: string;
        customers: string;
        new_customers: string;
      }>(
        `SELECT
           (SELECT COUNT(*)::int FROM orders
             WHERE created_at >= $1 AND status <> 'cancelled') AS orders,
           (SELECT COALESCE(SUM(total),0)::numeric(10,2) FROM orders
             WHERE created_at >= $1 AND status <> 'cancelled') AS revenue,
           (SELECT COALESCE(SUM(oi.quantity),0)::int FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
             WHERE o.created_at >= $1 AND o.status <> 'cancelled') AS units,
           (SELECT COALESCE(AVG(total),0)::numeric(10,2) FROM orders
             WHERE created_at >= $1 AND status <> 'cancelled') AS average_order,
           (SELECT COUNT(DISTINCT user_id)::int FROM orders
             WHERE created_at >= $1 AND status <> 'cancelled') AS customers,
           (SELECT COUNT(*)::int FROM users WHERE created_at >= $1) AS new_customers`,
        [from],
      ),

      query<{ day: string; value: string }>(
        `SELECT d.day::text,
                COALESCE(SUM(o.total), 0)::numeric(10,2)::text AS value
           FROM generate_series($1::date, $2::date, '1 day') AS d(day)
           LEFT JOIN orders o
             ON DATE(o.created_at) = d.day AND o.status <> 'cancelled'
          GROUP BY d.day
          ORDER BY d.day`,
        [from, to],
      ),

      query<{ name: string; units: string; revenue: string; stock: number }>(
        `SELECT p.name,
                SUM(oi.quantity)::int AS units,
                SUM(oi.quantity * oi.unit_price)::numeric(10,2)::text AS revenue,
                p.stock_quantity AS stock
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           JOIN products p ON p.id = oi.product_id
          WHERE o.created_at >= $1 AND o.status <> 'cancelled'
          GROUP BY p.id, p.name, p.stock_quantity
          ORDER BY revenue DESC
          LIMIT 10`,
        [from],
      ),

      query<{ name: string; revenue: string; units: string }>(
        `SELECT COALESCE(c.name, 'Uncategorised') AS name,
                SUM(oi.quantity * oi.unit_price)::numeric(10,2)::text AS revenue,
                SUM(oi.quantity)::int AS units
           FROM order_items oi
           JOIN orders o ON o.id = oi.order_id
           JOIN products p ON p.id = oi.product_id
           LEFT JOIN categories c ON c.id = p.category_id
          WHERE o.created_at >= $1 AND o.status <> 'cancelled'
          GROUP BY c.name
          ORDER BY revenue DESC`,
        [from],
      ),

      query<{ name: string; email: string; orders: string; revenue: string }>(
        `SELECT COALESCE(NULLIF(u.full_name, ''), u.email) AS name,
                u.email,
                COUNT(o.id)::int AS orders,
                COALESCE(SUM(o.total),0)::numeric(10,2)::text AS revenue
           FROM users u
           JOIN orders o ON o.user_id = u.id
          WHERE o.created_at >= $1 AND o.status <> 'cancelled'
          GROUP BY u.id, u.full_name, u.email
          ORDER BY revenue DESC
          LIMIT 10`,
        [from],
      ),

      query<{ name: string; stock: number; sku: null }>(
        `SELECT name, stock_quantity AS stock, NULL::text AS sku
           FROM products
          WHERE stock_quantity <= 5 AND COALESCE(status, 'active') = 'active'
          ORDER BY stock_quantity ASC, name
          LIMIT 10`,
      ),

      query<{ status: string; count: string }>(
        `SELECT status, COUNT(*)::text AS count
           FROM quote_requests
          GROUP BY status
          ORDER BY COUNT(*) DESC`,
      ),
    ]);

  const totalQuotes = quoteFunnel.reduce((sum, r) => sum + Number(r.count), 0);
  const wonQuotes = quoteFunnel
    .filter((r) => r.status === "accepted")
    .reduce((sum, r) => sum + Number(r.count), 0);

  return {
    window: { days, from: from.toISOString(), to: to.toISOString() },
    totals: {
      orders: Number(totals[0]?.orders ?? 0),
      revenue: Number(totals[0]?.revenue ?? 0),
      units: Number(totals[0]?.units ?? 0),
      average_order: Number(totals[0]?.average_order ?? 0),
      customers: Number(totals[0]?.customers ?? 0),
      new_customers: Number(totals[0]?.new_customers ?? 0),
      quotes: totalQuotes,
      quote_conversion: totalQuotes > 0 ? Math.round((wonQuotes / totalQuotes) * 100) : 0,
    },
    revenueByDay: revenueByDay.map((r) => ({ label: r.day, value: Number(r.value) })),
    topProducts: topProducts.map((r) => ({
      name: r.name,
      units: Number(r.units),
      revenue: Number(r.revenue),
      stock: Number(r.stock ?? 0),
    })),
    revenueByCategory: revenueByCategory.map((r) => ({
      name: r.name,
      revenue: Number(r.revenue),
      units: Number(r.units),
    })),
    topCustomers: topCustomers.map((r) => ({
      name: r.name,
      email: r.email,
      orders: Number(r.orders),
      revenue: Number(r.revenue),
    })),
    lowStock: lowStock.map((r) => ({
      name: r.name,
      stock: Number(r.stock ?? 0),
      sku: r.sku,
    })),
    quoteFunnel: quoteFunnel.map((r) => ({ label: r.status, value: Number(r.count) })),
  };
}

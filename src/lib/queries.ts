import { query } from "./db";
import type {
  CartLine,
  Category,
  CustomerOrder,
  Product,
  ProductDetail,
  Quote,
  QuoteStatus,
} from "./types";

/* Allowlist for ORDER BY so sort input can never reach SQL as free text. */
const SORTABLE = {
  newest: "p.created_at DESC, p.id DESC",
  price_asc: "p.price ASC, p.id ASC",
  price_desc: "p.price DESC, p.id DESC",
  name: "p.name ASC",
} as const;

type SortKey = keyof typeof SORTABLE;

/** Columns every product listing shares: product + category + first image. */
const PRODUCT_SELECT = `
  SELECT
    p.id, p.name, p.slug, p.sku, p.description, p.price,
    p.category_id, p.subcategory_id, p.is_new, p.is_featured,
    COALESCE(p.is_custom, FALSE) AS is_custom,
    p.stock_quantity, p.created_at,
    c.name  AS category_name,
    c.slug  AS category_slug,
    img.image_url AS image_url
FROM products p
LEFT JOIN categories c ON c.id = p.category_id
LEFT JOIN LATERAL (
  SELECT pi.image_url
  FROM product_images pi
  WHERE pi.product_id = p.id
  ORDER BY pi.position ASC, pi.id ASC
  LIMIT 1
) img ON TRUE`;

export async function getCategories(): Promise<Category[]> {
  return query<Category>(
    `SELECT c.id, c.name, c.slug, c.image_url, c.image_alt, c.description,
            c.icon, c.sort_order, COUNT(p.id)::int AS product_count
     FROM categories c
     LEFT JOIN products p ON p.category_id = c.id AND COALESCE(p.status, 'active') = 'active'
     WHERE c.is_active = TRUE
     GROUP BY c.id, c.name, c.slug, c.image_url, c.image_alt, c.description, c.icon, c.sort_order
     ORDER BY c.sort_order ASC, c.id ASC`,
  );
}

export type AdminSubcategory = {
  id: number;
  category_id: number;
  category_slug: string;
  name: string;
  slug: string;
};

export async function getSubcategories(): Promise<AdminSubcategory[]> {
  return query<AdminSubcategory>(
    `SELECT s.id, s.category_id, c.slug AS category_slug, s.name, s.slug
       FROM subcategories s
       JOIN categories c ON c.id = s.category_id
      WHERE c.is_active = TRUE
      ORDER BY c.sort_order, s.position, s.name`,
  );
}

export type ProductFilters = {
  category?: string;
  subcategory?: string;
  featured?: boolean;
  isNew?: boolean;
  search?: string;
  sort?: string;
  limit?: number;
  offset?: number;
};

export async function getProducts(
  filters: ProductFilters = {},
): Promise<{ products: Product[]; total: number }> {
  const where: string[] = ["COALESCE(p.status, 'active') = 'active'"];
  const params: unknown[] = [];

  if (filters.category) {
    // Accept either a slug or a numeric id.
    if (/^\d+$/.test(filters.category)) {
      params.push(Number(filters.category));
      where.push(`p.category_id = $${params.length}`);
    } else {
      params.push(filters.category);
      where.push(`c.slug = $${params.length}`);
    }
  }
  if (filters.subcategory) {
    params.push(filters.subcategory);
    where.push(
      `p.subcategory_id = (SELECT s.id FROM subcategories s
         WHERE s.category_id = p.category_id AND s.slug = $${params.length})`,
    );
  }
  if (filters.featured) where.push("p.is_featured = TRUE");
  if (filters.isNew) where.push("p.is_new = TRUE");
  if (filters.search) {
    params.push(`%${filters.search}%`);
    // Also match variant names/colours, so searching a timber like "walnut"
    // finds the piece that offers it even when the name doesn't mention it.
    where.push(`(
      p.name ILIKE $${params.length}
      OR p.description ILIKE $${params.length}
      OR EXISTS (
        SELECT 1 FROM product_variants pv
        WHERE pv.product_id = p.id
          AND (pv.variant_name ILIKE $${params.length} OR pv.color ILIKE $${params.length})
      )
    )`);
  }

  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const sort: string =
    SORTABLE[(filters.sort ?? "newest") as SortKey] ?? SORTABLE.newest;

  const limit = Math.min(Math.max(filters.limit ?? 24, 1), 100);
  const offset = Math.max(filters.offset ?? 0, 0);
  params.push(limit, offset);

  const products = await query<Product>(
    `${PRODUCT_SELECT}
     ${clause}
     ORDER BY ${sort}
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(*)::int AS count
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     ${clause}`,
    params.slice(0, params.length - 2),
  );

  return { products, total: Number(count) };
}

export async function getProductsForPlacement(
  navItemId: number,
  sectionId?: number | null,
  navItemSlug?: string,
): Promise<{ products: Product[]; total: number }> {
  const params: unknown[] = [navItemId];
  let placementFilter = "pp.nav_item_id = $1";
  if (sectionId !== undefined) {
    params.push(sectionId);
    placementFilter += ` AND pp.mega_section_id IS NOT DISTINCT FROM $${params.length}`;
  }
  let featuredFilter = "";
  if (navItemSlug === "new-arrivals") featuredFilter = " OR p.is_new = TRUE";
  if (navItemSlug === "best-sellers") featuredFilter = " OR p.is_featured = TRUE";
  const products = await query<Product>(
    `${PRODUCT_SELECT}
     WHERE COALESCE(p.status, 'active') = 'active'
       AND (EXISTS (
         SELECT 1 FROM product_placements pp
          WHERE pp.product_id = p.id AND ${placementFilter}
       )${featuredFilter})
     ORDER BY p.created_at DESC, p.id DESC
     LIMIT 100`,
    params,
  );
  const [{ count }] = await query<{ count: string }>(
    `SELECT COUNT(DISTINCT p.id)::text AS count
       FROM products p
      WHERE COALESCE(p.status, 'active') = 'active'
        AND (EXISTS (
          SELECT 1 FROM product_placements pp
           WHERE pp.product_id = p.id AND ${placementFilter}
        )${featuredFilter})`,
    params,
  );
  return { products, total: Number(count ?? 0) };
}

export async function getProductBySlug(slug: string): Promise<ProductDetail | null> {
  const [product] = await query<Product>(
    `${PRODUCT_SELECT} WHERE p.slug = $1 AND COALESCE(p.status, 'active') = 'active'`,
    [slug],
  );
  if (!product) return null;

  const images = await query<{ id: number; image_url: string; position: number }>(
    `SELECT id, image_url, position
     FROM product_images
     WHERE product_id = $1
     ORDER BY position ASC, id ASC`,
    [product.id],
  );

  const variants = await query<{
    id: number;
    variant_name: string | null;
    color: string | null;
    price_modifier: string;
    image_url: string | null;
  }>(
    `SELECT id, variant_name, color, price_modifier, image_url
     FROM product_variants
     WHERE product_id = $1
     ORDER BY id ASC`,
    [product.id],
  );

  return { ...product, images, variants };
}

export async function getCart(userId: number): Promise<CartLine[]> {
  return query<CartLine>(
    `SELECT
       ci.id,
       ci.quantity,
       ci.product_id,
       ci.variant_id,
       p.name        AS product_name,
       p.slug        AS product_slug,
       COALESCE(img.image_url, pv.image_url) AS image_url,
       pv.variant_name,
       COALESCE(pv.price_modifier, 0)      AS price_modifier,
       (p.price + COALESCE(pv.price_modifier, 0))::numeric(10,2) AS unit_price,
       ((p.price + COALESCE(pv.price_modifier, 0)) * ci.quantity)::numeric(10,2) AS line_total
     FROM cart_items ci
     JOIN products p ON p.id = ci.product_id
     LEFT JOIN product_variants pv ON pv.id = ci.variant_id
     LEFT JOIN LATERAL (
       SELECT pi.image_url FROM product_images pi
       WHERE pi.product_id = p.id
       ORDER BY pi.position ASC, pi.id ASC
       LIMIT 1
      ) img ON TRUE
     WHERE ci.user_id = $1
     ORDER BY ci.added_at ASC, ci.id ASC`,
    [userId],
  );
}

/* ------------------------------------------------------------ admin: inbox */

const QUOTE_SELECT = `
  SELECT id, name, email, phone, company, project_type, budget, timeline,
         message, product_slug, status, created_at
  FROM quote_requests`;

/**
 * Inbox listing. `status` and `search` are validated by the caller and passed
 * as bound parameters, so neither can reach SQL as free text.
 */
export async function getQuotes(opts: { status?: string; search?: string } = {}): Promise<Quote[]> {
  const where: string[] = [];
  const params: unknown[] = [];

  if (opts.status) {
    params.push(opts.status);
    where.push(`status = $${params.length}`);
  }
  if (opts.search) {
    params.push(`%${opts.search}%`);
    where.push(
      `(name ILIKE $${params.length} OR email ILIKE $${params.length} OR company ILIKE $${params.length})`,
    );
  }

  const filter = where.length ? `WHERE ${where.join(" AND ")}` : "";

  return query<Quote>(
    `${QUOTE_SELECT} ${filter} ORDER BY created_at DESC, id DESC LIMIT 200`,
    params,
  );
}

/** Move an enquiry to a new status. Returns null when the id is unknown. */
export async function setQuoteStatus(
  id: number,
  status: QuoteStatus,
): Promise<Pick<Quote, "id" | "status"> | null> {
  const rows = await query<Pick<Quote, "id" | "status">>(
    `UPDATE quote_requests SET status = $1 WHERE id = $2 RETURNING id, status`,
    [status, id],
  );
  return rows[0] ?? null;
}

/** Headline counts for the inbox filters. */
export async function getQuoteCounts(): Promise<Record<string, number>> {
  const rows = await query<{ status: string; count: number }>(
    `SELECT status, COUNT(*)::int AS count FROM quote_requests GROUP BY status`,
  );
  const counts: Record<string, number> = { all: 0 };
  for (const row of rows) {
    counts[row.status] = row.count;
    counts.all += row.count;
  }
  return counts;
}

/* --------------------------------------------------------- order receipt */

/**
 * One order, looked up by its customer-facing number, for the confirmation
 * page. The product name on each line is the copy taken at the time of order,
 * with a fall back to the live product in case an old row predates that column.
 */
export async function getOrderByNumber(orderNumber: string): Promise<CustomerOrder | null> {
  const [order] = await query<CustomerOrder>(
    `SELECT o.order_number, o.status, o.total, o.created_at,
            o.customer_name, o.customer_phone,
            o.delivery_district, o.delivery_sector, o.delivery_landmark,
            o.delivery_note, o.payment_method
       FROM orders o
      WHERE o.order_number = $1`,
    [orderNumber],
  );
  if (!order) return null;

  const items = await query<CustomerOrder["items"][number]>(
    `SELECT oi.id, oi.product_id, p.slug,
            COALESCE(oi.product_name, p.name) AS name,
            pv.variant_name,
            (SELECT pi.image_url FROM product_images pi
              WHERE pi.product_id = oi.product_id
              ORDER BY pi.position, pi.id LIMIT 1) AS image_url,
            oi.quantity,
            oi.unit_price,
            (oi.unit_price * oi.quantity)::numeric(10,2) AS line_total
       FROM order_items oi
       LEFT JOIN products p ON p.id = oi.product_id
       LEFT JOIN product_variants pv ON pv.id = oi.variant_id
      WHERE oi.order_id = (SELECT id FROM orders WHERE order_number = $1)
      ORDER BY oi.id ASC`,
    [orderNumber],
  );

  return { ...order, items };
}


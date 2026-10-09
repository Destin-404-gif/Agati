import { positiveInt, boolParam } from "./api";
import { query } from "./db";

/**
 * Generic list queries shared by every admin module.
 *
 * Each call site supplies an allow-list of sortable columns, so a request can
 * never inject SQL through the `sort` parameter. Search terms are bound as
 * parameters and any LIKE wildcards the user typed are neutralised.
 */

export interface ListParams {
  q?: string | null;
  sort?: string | null;
  dir?: "asc" | "desc";
  page?: number;
  perPage?: number;
  filters?: Record<string, string | undefined | null>;
}

export interface ListResult<T> {
  rows: T[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
}

/** Trim a search term and neutralise LIKE metacharacters. */
export function cleanSearch(input: string | undefined | null): string | undefined {
  const value = input?.trim().slice(0, 120);
  if (!value) return undefined;
  const escaped = value.replace(/[%_\\]/g, (c) => `\\${c}`);
  return escaped || undefined;
}

export function resolveSort(
  sort: string | undefined | null,
  dir: string | undefined | null,
  allowed: readonly string[],
  fallback: string,
): { column: string; direction: "ASC" | "DESC" } {
  const column = sort && allowed.includes(sort) ? sort : fallback;
  const direction = String(dir).toLowerCase() === "asc" ? "ASC" : "DESC";
  return { column, direction };
}

export function resolvePaging(
  page: number,
  perPage: number,
  maxPerPage = 100,
): { page: number; perPage: number; offset: number; limit: number } {
  const safePerPage = Math.min(Math.max(Math.trunc(perPage) || 20, 1), maxPerPage);
  const safePage = Math.max(Math.trunc(page) || 1, 1);
  return {
    page: safePage,
    perPage: safePerPage,
    offset: (safePage - 1) * safePerPage,
    limit: safePerPage,
  };
}

/** Builds the parameterised parts of a list query. */
export function listParams(params: ListParams) {
  const paging = resolvePaging(params.page ?? 1, params.perPage ?? 20);
  return { paging, search: cleanSearch(params.q), searchRaw: params.q?.trim().slice(0, 120) || undefined };
}

export function parseListParams(
  sp: URLSearchParams,
  defaults: { perPage?: number } = {},
): ListParams {
  const filters: Record<string, string> = {};
  for (const [key, value] of sp.entries()) {
    if (["q", "sort", "dir", "page", "perPage", "format"].includes(key)) continue;
    if (value) filters[key] = value;
  }

  return {
    q: sp.get("q"),
    sort: sp.get("sort"),
    dir: sp.get("dir") === "asc" ? "asc" : "desc",
    page: positiveInt(sp.get("page"), 1),
    perPage: positiveInt(sp.get("perPage"), defaults.perPage ?? 20),
    filters,
  };
}

/* --------------------------------------------------------- staff and roles */

const STAFF_SORTS = ["email", "full_name", "role", "last_login_at", "created_at"] as const;

export interface StaffRow {
  id: number;
  email: string;
  full_name: string | null;
  role_id: number | null;
  role_name: string | null;
  role_slug: string | null;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface RoleRow {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  staff_count: number;
  permissions: string[];
}

export async function listStaff(
  params: ListParams,
): Promise<ListResult<StaffRow>> {
  const { paging, search } = listParams(params);
  const { column, direction } = resolveSort(
    params.sort,
    params.dir,
    STAFF_SORTS,
    "email",
  );

  const where: string[] = [];
  const args: unknown[] = [];

  if (search) {
    args.push(`%${search}%`);
    const i = args.length;
    where.push(`(s.email ILIKE $${i} OR s.full_name ILIKE $${i} OR r.name ILIKE $${i})`);
  }

  const filters = params.filters ?? {};
  if (filters.role) {
    args.push(filters.role);
    where.push(`r.slug = $${args.length}`);
  }
  if (filters.active === "true") where.push(`s.is_active`);
  if (filters.active === "false") where.push(`NOT s.is_active`);

  const from = `FROM staff_users s LEFT JOIN roles r ON r.id = s.role_id`;
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count ${from} ${whereSql}`,
    args,
  );
  const total = Number(countRows[0]?.count ?? 0);

  const orderSql = `ORDER BY ${
    column === "role" ? "r.name" : `s.${column}`
  } ${direction} NULLS LAST`;

  args.push(paging.limit, paging.offset);
  const rows = await query<StaffRow>(
    `SELECT s.id, s.email, s.full_name, s.role_id, r.name AS role_name,
            r.slug AS role_slug, s.is_active, s.last_login_at, s.created_at
       ${from} ${whereSql} ${orderSql}
       LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return {
    rows,
    total,
    page: paging.page,
    perPage: paging.perPage,
    pageCount: Math.max(Math.ceil(total / paging.perPage), 1),
  };
}

export async function listRoles(): Promise<RoleRow[]> {
  const rows = await query<RoleRow>(
    `SELECT r.id, r.name, r.slug, r.description,
            (SELECT COUNT(*)::int FROM staff_users s WHERE s.role_id = r.id)
              AS staff_count,
            COALESCE(
              (SELECT array_agg(p.key ORDER BY p.key)
                 FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id
                WHERE rp.role_id = r.id),
              ARRAY[]::varchar[]
            ) AS permissions
       FROM roles r
      ORDER BY r.name`,
  );
  return rows;
}

/* ------------------------------------------------------------- categories */

const CATEGORY_SORTS = ["name", "slug", "created_at", "products"] as const;

export interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  image_alt: string | null;
  created_at: string;
  product_count: number;
}

export async function listCategories(
  params: ListParams,
): Promise<ListResult<CategoryRow>> {
  const { paging, search } = listParams(params);
  const { column, direction } = resolveSort(
    params.sort,
    params.dir,
    CATEGORY_SORTS,
    "name",
  );

  const where: string[] = [];
  const args: unknown[] = [];

  if (search) {
    args.push(`%${search}%`);
    const i = args.length;
    where.push(`(c.name ILIKE $${i} OR c.slug ILIKE $${i})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM categories c ${whereSql}`,
    args,
  );
  const total = Number(countRows[0]?.count ?? 0);

  const orderSql = `ORDER BY ${
    column === "products" ? "product_count" : `c.${column}`
  } ${direction} NULLS LAST`;

  args.push(paging.limit, paging.offset);
  const rows = await query<CategoryRow>(
    `SELECT c.id, c.name, c.slug, c.image_url, c.image_alt, c.created_at,
            (SELECT COUNT(*)::int FROM products p WHERE p.category_id = c.id)
              AS product_count
       FROM categories c ${whereSql} ${orderSql}
       LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return {
    rows,
    total,
    page: paging.page,
    perPage: paging.perPage,
    pageCount: Math.max(Math.ceil(total / paging.perPage), 1),
  };
}

/* --------------------------------------------------------------- products */

const PRODUCT_SORTS = [
  "name",
  "price",
  "stock_quantity",
  "created_at",
  "status",
  "category",
] as const;

const PRODUCT_COLUMNS = `
  p.id, p.name, p.slug, p.description, p.price, p.category_id, p.subcategory_id,
  p.is_new, p.is_featured, p.stock_quantity, p.created_at,
  COALESCE(p.is_custom, FALSE) AS is_custom,
  COALESCE(p.status, 'active') AS status,
  c.name AS category_name, c.slug AS category_slug,
  (SELECT string_agg(
            n.label || CASE WHEN ms.name IS NULL THEN '' ELSE ' > ' || ms.name END,
            ' · ' ORDER BY pp.id
          )
     FROM product_placements pp
     JOIN nav_items n ON n.id = pp.nav_item_id
     LEFT JOIN mega_menu_sections ms ON ms.id = pp.mega_section_id
    WHERE pp.product_id = p.id) AS placement_summary,
  (SELECT pi.image_url FROM product_images pi
     WHERE pi.product_id = p.id ORDER BY pi.position, pi.id LIMIT 1) AS image_url,
  (SELECT COUNT(*)::int FROM product_images pi WHERE pi.product_id = p.id) AS image_count,
  (SELECT COUNT(*)::int FROM product_variants pv WHERE pv.product_id = p.id) AS variant_count
`;

export interface ProductRow {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  category_id: number | null;
  subcategory_id: number | null;
  category_name: string | null;
  category_slug: string | null;
  placement_summary: string | null;
  is_new: boolean;
  is_featured: boolean;
  /** Made to measure: the storefront shows a quote request instead of a cart button. */
  is_custom: boolean;
  stock_quantity: number;
  status: string;
  image_url: string | null;
  image_count: number;
  variant_count: number;
  created_at: string;
}

export async function listProducts(
  params: ListParams,
): Promise<ListResult<ProductRow>> {
  const { paging, search } = listParams(params);
  const { column, direction } = resolveSort(
    params.sort,
    params.dir,
    PRODUCT_SORTS,
    "created_at",
  );

  const where: string[] = [];
  const args: unknown[] = [];

  if (search) {
    args.push(`%${search}%`);
    const i = args.length;
    where.push(
      `(p.name ILIKE $${i} OR p.slug ILIKE $${i} OR p.description ILIKE $${i} OR c.name ILIKE $${i})`,
    );
  }

  const f = params.filters ?? {};
  if (f.status) {
    args.push(f.status);
    where.push(`COALESCE(p.status, 'active') = $${args.length}`);
  }
  if (f.category) {
    args.push(f.category);
    where.push(`c.slug = $${args.length}`);
  }
  if (f.stock === "low") where.push(`p.stock_quantity <= 3`);
  if (f.stock === "out") where.push(`p.stock_quantity <= 0`);
  if (f.stock === "in") where.push(`p.stock_quantity > 0`);
  if (f.featured === "true") where.push(`p.is_featured`);
  if (f.is_new === "true") where.push(`p.is_new`);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql =
    column === "category"
      ? `ORDER BY c.name ${direction} NULLS LAST, p.name ASC`
      : `ORDER BY p.${column} ${direction} NULLS LAST, p.id ASC`;

  const countRows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       ${whereSql}`,
    args,
  );
  const total = Number(countRows[0]?.count ?? 0);

  args.push(paging.limit, paging.offset);
  const rows = await query<ProductRow>(
    `SELECT ${PRODUCT_COLUMNS}
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       ${whereSql}
       ${orderSql}
       LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return {
    rows,
    total,
    page: paging.page,
    perPage: paging.perPage,
    pageCount: Math.max(Math.ceil(total / paging.perPage), 1),
  };
}

export async function getAllProductsForExport(): Promise<ProductRow[]> {
  return query<ProductRow>(
    `SELECT ${PRODUCT_COLUMNS}
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
      ORDER BY p.name ASC`,
  );
}

/* ----------------------------------------------------------------- orders */

const ORDER_SORTS = ["id", "total", "status", "created_at", "customer"] as const;

export interface OrderRow {
  id: number;
  user_id: number | null;
  status: string;
  total: string;
  notes: string | null;
  created_at: string;
  /** Customer-facing reference, e.g. `AGT-00042`. Null on older rows. */
  order_number: string | null;
  /** Checkout copies. Falls back to the linked account row when null. */
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  delivery_district: string | null;
  delivery_sector: string | null;
  delivery_landmark: string | null;
  payment_method: string | null;
  item_count: number;
}

export async function listOrders(
  params: ListParams,
): Promise<ListResult<OrderRow>> {
  const { paging, search, searchRaw } = listParams(params);
  const { column, direction } = resolveSort(
    params.sort,
    params.dir,
    ORDER_SORTS,
    "created_at",
  );

  const from = `FROM orders o
               LEFT JOIN users u ON u.id = o.user_id`;

  const where: string[] = [];
  const args: unknown[] = [];

  if (search) {
    args.push(`%${search}%`);
    const i = args.length;
    // The id comparison needs the raw term: matching against the
    // wildcard-wrapped pattern could never be equal.
    args.push(searchRaw ?? search);
    const idParam = args.length;
where.push(
        `(u.full_name ILIKE $${i} OR u.email ILIKE $${i} OR o.status ILIKE $${i}` +
          // The workshop quotes order numbers back to customers, and phone is
          // how they are found on the floor.
          " OR o.order_number ILIKE $" + i +
          " OR o.customer_phone ILIKE $" + i +
          " OR o.customer_name ILIKE $" + i +
          (searchRaw ? ` OR CAST(o.id AS TEXT) = $${idParam}` : "") +
          ")",
      );
  }

  const f = params.filters ?? {};
  if (f.status) {
    args.push(f.status);
    where.push(`o.status = $${args.length}`);
  }
  if (f.open === "true") where.push(`o.status IN ('pending','processing')`);

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql =
    column === "customer"
      ? `ORDER BY u.full_name ${direction} NULLS LAST, o.id DESC`
      : column === "id"
        ? `ORDER BY o.id ${direction}`
        : `ORDER BY o.${column} ${direction} NULLS LAST`;

  const countRows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count ${from} ${whereSql}`,
    args,
  );
  const total = Number(countRows[0]?.count ?? 0);

  args.push(paging.limit, paging.offset);
  const rows = await query<OrderRow>(
    `SELECT o.id, o.user_id, o.status, o.total, o.notes, o.created_at,
            o.order_number, o.customer_phone,
            o.delivery_district, o.delivery_sector, o.delivery_landmark,
            o.payment_method,
            COALESCE(o.customer_name, u.full_name) AS customer_name,
            COALESCE(o.customer_email, u.email)    AS customer_email,
            (SELECT COALESCE(SUM(quantity), 0)::int FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       ${from} ${whereSql} ${orderSql}
       LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return {
    rows,
    total,
    page: paging.page,
    perPage: paging.perPage,
    pageCount: Math.max(Math.ceil(total / paging.perPage), 1),
  };
}

/* -------------------------------------------------------------- customers */

const CUSTOMER_SORTS = ["email", "full_name", "created_at", "orders"] as const;

export interface CustomerRow {
  id: number;
  email: string;
  full_name: string | null;
  created_at: string;
  order_count: number;
  lifetime_value: string;
  last_order_at: string | null;
}

export async function listCustomers(
  params: ListParams,
): Promise<ListResult<CustomerRow>> {
  const { paging, search } = listParams(params);
  const { column, direction } = resolveSort(
    params.sort,
    params.dir,
    CUSTOMER_SORTS,
    "created_at",
  );

  const where: string[] = [];
  const args: unknown[] = [];

  if (search) {
    args.push(`%${search}%`);
    const i = args.length;
    where.push(`(u.email ILIKE $${i} OR u.full_name ILIKE $${i})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const countRows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM users u ${whereSql}`,
    args,
  );
  const total = Number(countRows[0]?.count ?? 0);

  const orderSql = `ORDER BY ${
    column === "orders" ? "order_count" : `u.${column}`
  } ${direction} NULLS LAST`;

  args.push(paging.limit, paging.offset);
  const rows = await query<CustomerRow>(
    `SELECT u.id, u.email, u.full_name, u.created_at,
            (SELECT COUNT(*)::int FROM orders o WHERE o.user_id = u.id) AS order_count,
            (SELECT COALESCE(SUM(o.total), 0)::text FROM orders o
              WHERE o.user_id = u.id AND o.status <> 'cancelled') AS lifetime_value,
            (SELECT MAX(o.created_at) FROM orders o WHERE o.user_id = u.id) AS last_order_at
       FROM users u ${whereSql} ${orderSql}
       LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return {
    rows,
    total,
    page: paging.page,
    perPage: paging.perPage,
    pageCount: Math.max(Math.ceil(total / paging.perPage), 1),
  };
}

/* ----------------------------------------------------------------- quotes */

const QUOTE_SORTS = ["id", "name", "email", "status", "created_at"] as const;

export interface QuoteRow {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  project_type: string | null;
  budget: string | null;
  timeline: string | null;
  message: string | null;
  product_slug: string | null;
  status: string;
  created_at: string;
  note_count: number;
}

export async function listQuotes(
  params: ListParams,
): Promise<ListResult<QuoteRow>> {
  const { paging, search, searchRaw } = listParams(params);
  const { column, direction } = resolveSort(
    params.sort,
    params.dir,
    QUOTE_SORTS,
    "created_at",
  );

  const from = `FROM quote_requests q`;

  const where: string[] = [];
  const args: unknown[] = [];

  if (search) {
    args.push(`%${search}%`);
    const i = args.length;
    // Raw term for the id equality; the wildcard pattern would never match.
    args.push(searchRaw ?? search);
    const idParam = args.length;
    where.push(
      `(q.name ILIKE $${i} OR q.email ILIKE $${i} OR q.company ILIKE $${i}` +
        (searchRaw ? ` OR CAST(q.id AS TEXT) = $${idParam}` : "") +
        ")",
    );
  }

  const f = params.filters ?? {};
  if (f.status) {
    args.push(f.status);
    where.push(`q.status = $${args.length}`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql =
    column === "id"
      ? `ORDER BY q.id ${direction}`
      : `ORDER BY q.${column} ${direction} NULLS LAST`;

  const countRows = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count ${from} ${whereSql}`,
    args,
  );
  const total = Number(countRows[0]?.count ?? 0);

  args.push(paging.limit, paging.offset);
  const rows = await query<QuoteRow>(
    `SELECT q.*,
            (SELECT COUNT(*)::int FROM quote_notes n WHERE n.quote_id = q.id) AS note_count
       ${from} ${whereSql} ${orderSql}
       LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );

  return {
    rows,
    total,
    page: paging.page,
    perPage: paging.perPage,
    pageCount: Math.max(Math.ceil(total / paging.perPage), 1),
  };
}

export { boolParam };
export { can } from "./staff";
export type { StaffWithPermissions } from "./staff";

import type { PoolClient } from "pg";

/**
 * Server-side pricing for cart lines and orders.
 *
 * The browser never gets to say what something costs. Every total in this
 * project is rebuilt here from `products.price` and
 * `product_variants.price_modifier`, so a tampered request can change a quantity
 * but never a price.
 */

/** One requested line, as it arrives from a client. */
export type RequestedLine = {
  product_id: number;
  variant_id: number | null;
  quantity: number;
};

/** A requested line once the database has priced it. */
export type PricedLine = RequestedLine & {
  product_name: string;
  slug: string;
  image_url: string | null;
  variant_name: string | null;
  /** Frozen at this moment - this is what the order item records. */
  unit_price: number;
  line_total: number;
};

export type PricedCart = {
  lines: PricedLine[];
  /** Sum of the line totals. Never negative. */
  subtotal: number;
  /** Quantity above what is in stock, per product id. */
  out_of_stock: { product_id: number; requested: number; available: number }[];
};

/** Thrown for problems the route should surface as a 4xx. */
export class PricingError extends Error {
  constructor(
    message: string,
    readonly code: "P404" | "P409" | "P400",
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "PricingError";
  }
}

const MAX_LINES = 50;
const MAX_QUANTITY = 99;

type ProductRow = {
  id: number;
  name: string;
  slug: string;
  price: string;
  stock_quantity: number | null;
  is_custom: boolean | null;
  status: string | null;
  image_url: string | null;
};

type VariantRow = {
  id: number;
  product_id: number;
  variant_name: string | null;
  price_modifier: string | null;
  image_url: string | null;
};

/** A variant row with the numeric columns already coerced. */
type Variant = {
  id: number;
  product_id: number;
  variant_name: string | null;
  price_modifier: number;
  image_url: string | null;
};

/** Clamp and bound a client-supplied quantity. Never returns below 1. */
export function safeQuantity(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.trunc(n), 1), MAX_QUANTITY);
}

/** Drop anything malformed and merge duplicate product+variant lines. */
export function normalizeRequestedLines(raw: unknown): RequestedLine[] {
  if (!Array.isArray(raw)) return [];

  const merged = new Map<string, RequestedLine>();

  for (const entry of raw.slice(0, MAX_LINES * 2)) {
    const o = (entry ?? {}) as Record<string, unknown>;
    const productId = Number(o.product_id);
    if (!Number.isInteger(productId) || productId < 1) continue;

    const variantRaw = o.variant_id;
    const variantId =
      variantRaw === null || variantRaw === undefined || variantRaw === "" || variantRaw === 0
        ? null
        : Number(variantRaw);
    if (variantId !== null && (!Number.isInteger(variantId) || variantId < 1)) continue;

    const quantity = safeQuantity(o.quantity);
    const key = `${productId}:${variantId ?? 0}`;
    const existing = merged.get(key);
    // Merging keeps a client from smuggling extra stock past the cap by
    // sending the same product twice.
    merged.set(key, {
      product_id: productId,
      variant_id: variantId,
      quantity: Math.min((existing?.quantity ?? 0) + quantity, MAX_QUANTITY),
    });
  }

  return [...merged.values()].slice(0, MAX_LINES);
}

/**
 * Price a set of requested lines from the database.
 *
 * `lock` takes `FOR UPDATE` on the product rows, which the order route needs so
 * two simultaneous checkouts cannot both pass the stock check. Read-only callers
 * (the cart page) leave it off.
 */
export async function priceLines(
  client: PoolClient,
  requested: RequestedLine[],
  options: { lock?: boolean; enforceStock?: boolean } = {},
): Promise<PricedCart> {
  const enforceStock = options.enforceStock ?? true;
  if (requested.length === 0) {
    return { lines: [], subtotal: 0, out_of_stock: [] };
  }

  const productIds = [...new Set(requested.map((l) => l.product_id))].sort((a, b) => a - b);

  const { rows: productRows } = await client.query(
    `SELECT p.id,
            p.name,
            p.slug,
            p.price,
            p.stock_quantity,
            p.is_custom,
            COALESCE(p.status, 'active') AS status,
            (SELECT pi.image_url FROM product_images pi
              WHERE pi.product_id = p.id
              ORDER BY pi.position, pi.id LIMIT 1) AS image_url
       FROM products p
      WHERE p.id = ANY($1::int[])
      ${options.lock ? "FOR UPDATE OF p" : ""}`,
    [productIds],
  );

  const products = new Map<
    number,
    {
      name: string;
      slug: string;
      price: number;
      stock: number;
      is_custom: boolean;
      status: string;
      image_url: string | null;
    }
  >();
  for (const r of productRows as ProductRow[]) {
    products.set(r.id, {
      name: r.name,
      slug: r.slug,
      price: Number(r.price),
      stock: r.stock_quantity ?? 0,
      is_custom: Boolean(r.is_custom),
      status: r.status ?? "active",
      image_url: r.image_url,
    });
  }

  const variantIds = [
    ...new Set(requested.map((l) => l.variant_id).filter((v): v is number => v !== null)),
  ];

  const variants = new Map<number, Variant>();
  if (variantIds.length) {
    const { rows } = await client.query(
      `SELECT id, product_id, variant_name, price_modifier, image_url
         FROM product_variants
        WHERE id = ANY($1::int[])`,
      [variantIds],
    );
    for (const v of rows as VariantRow[]) {
      variants.set(v.id, {
        id: v.id,
        product_id: v.product_id,
        variant_name: v.variant_name,
        price_modifier: Number(v.price_modifier ?? 0),
        image_url: v.image_url,
      });
    }
  }

  const out_of_stock: PricedCart["out_of_stock"] = [];

  const lines = requested.map((line) => {
    const product = products.get(line.product_id);
    if (!product) {
      throw new PricingError("One of the items is no longer available", "P404", {
        items: "One of the items is no longer available",
      });
    }
    if (product.status !== "active") {
      throw new PricingError(`${product.name} is no longer on sale`, "P404", {
        items: `${product.name} is no longer on sale`,
      });
    }
    if (product.is_custom) {
      // Made-to-measure pieces are priced per commission and must go through the
      // quote form instead, whatever the client asked for.
      throw new PricingError(`${product.name} is made to order - please request a quote`, "P400", {
        items: `${product.name} is priced per commission - request a quote instead`,
      });
    }

    let modifier = 0;
    let variantName: string | null = null;
    let variantImage: string | null = null;
    if (line.variant_id !== null) {
      const variant = variants.get(line.variant_id);
      if (!variant || variant.product_id !== line.product_id) {
        throw new PricingError("One of the chosen options is no longer available", "P404", {
          items: "One of the chosen options is no longer available",
        });
      }
      modifier = variant.price_modifier;
      variantName = variant.variant_name;
      variantImage = variant.image_url;
    }

    // A negative modifier can never drag a price below zero.
    const unit = Math.max(0, product.price + modifier);

    if (enforceStock && line.quantity > product.stock) {
      const message =
        product.stock > 0
          ? `Only ${product.stock} left of ${product.name}`
          : `${product.name} is out of stock`;
      out_of_stock.push({
        product_id: line.product_id,
        requested: line.quantity,
        available: product.stock,
      });
      throw new PricingError(message, "P409", { items: message });
    }

    return {
      ...line,
      product_name: product.name,
      slug: product.slug,
      image_url: variantImage ?? product.image_url,
      variant_name: variantName,
      unit_price: unit,
      line_total: Number((unit * line.quantity).toFixed(2)),
    } satisfies PricedLine;
  });

  const subtotal = Number(lines.reduce((sum, l) => sum + l.line_total, 0).toFixed(2));

  return { lines, subtotal: Math.max(0, subtotal), out_of_stock };
}
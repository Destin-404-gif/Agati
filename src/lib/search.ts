/**
 * Storefront search.
 *
 * Two sources are searched and merged:
 *
 *  1. PostgreSQL - product name, description, SKU, category name, and the
 *     variant name/colour. This is the part that has to be parameterised.
 *  2. `lib/navigation.ts` - the category and subcategory taxonomy, which lives
 *     in TypeScript because the database has no subcategory table.
 *
 * Every user-supplied value reaches Postgres as a bound parameter. The only
 * text ever spliced into the SQL is a rank CASE, a set of fixed filter
 * fragments, and an ORDER BY resolved through the `SEARCH_SORTABLE` allowlist,
 * so neither the term nor `?sort=` can be used to inject SQL.
 */

import { query } from "./db";
import {
  categoryItems,
  findCategory,
  findSubcategory,
  searchNav,
  type NavMatch,
} from "./navigation";
import type { Product } from "./types";

/** Below this, matches are too noisy to be useful. Enforced on both ends. */
export const MIN_TERM_LENGTH = 2;

/** Suggestions dropdown never returns more than this many products. */
export const SUGGESTION_LIMIT = 8;

export const RESULTS_PER_PAGE = 24;

/** `?sort=` allowlist - mirrors the one in queries.ts. */
const SEARCH_SORTABLE = {
  relevance: "m.rank ASC, p.name ASC, p.id ASC",
  price_asc: "p.price ASC, p.name ASC",
  price_desc: "p.price DESC, p.name ASC",
  newest: "p.created_at DESC, p.name ASC",
} as const;

export type SearchSort = keyof typeof SEARCH_SORTABLE;

export const isSearchSort = (v: string | null | undefined): v is SearchSort =>
  v != null && v in SEARCH_SORTABLE;

/* ------------------------------------------------------------------ helpers */

/**
 * Escape the LIKE metacharacters so a search for "50%" or "oak_" matches those
 * literal characters instead of turning the term into a wildcard. Postgres
 * treats backslash as the default LIKE escape, so doubling it is enough.
 *
 * This is belt-and-braces: the pattern is bound as a parameter either way, so
 * this is about correct results, not about SQL injection.
 */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => `\\${m}`);
const likeContains = (term: string) => `%${escapeLike(term)}%`;
const likePrefix = (term: string) => `${escapeLike(term)}%`;

/**
 * Words that carry no meaning when matching a taxonomy label against a product
 * name - "Office desks" and "Computer desks" are both just desks as far as the
 * catalogue is concerned.
 */
const TAXONOMY_STOPWORDS = new Set([
  "office",
  "room",
  "furniture",
  "wooden",
  "wood",
  "home",
  "the",
  "and",
]);

/** Crude English de-pluraliser, good enough for a best-effort extra pattern. */
function singular(word: string): string {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** LIKE patterns for one taxonomy label, e.g. "Office desks" -> desk, desks. */
function patternsForLabel(label: string): string[] {
  const words = label
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !TAXONOMY_STOPWORDS.has(w));
  if (words.length === 0) return [];

  const out = new Set<string>([label.toLowerCase()]);
  out.add(words.join(" "));
  for (const word of words) {
    out.add(word);
    out.add(singular(word));
  }
  return [...out].map(likeContains);
}

/**
 * Extra LIKE patterns derived from the subcategory labels that matched.
 *
 * The taxonomy has ~90 subcategories and the catalogue has 9 products, so most
 * subcategory pages legitimately have nothing to show. Where a word does line
 * up - "Dining chairs" against the Chairs category, "Bar stools" against the
 * Linden Counter Stool - this is what puts the real piece in front of the
 * customer instead of an empty grid.
 */
export function termPatterns(term: string, matches: NavMatch[]): string[] {
  const out = new Set<string>([likeContains(term)]);
  for (const match of matches) {
    for (const pattern of patternsForLabel(match.name)) out.add(pattern);
  }
  return [...out].slice(0, 20);
}

/**
 * LIKE patterns for a whole navigation category, used by the `?category=`
 * filter on /search.
 *
 * The navigation taxonomy has no database counterpart yet, so this matches on
 * product *name* against the category's own vocabulary. It is deliberately a
 * name-only match: widening it to the description would put a kitchen stool in
 * front of someone browsing Office, because its description mentions timber.
 * Once a `subcategories` table exists this becomes a real join.
 */
export function categoryPatterns(slug: string): string[] {
  const category = findCategory(slug);
  if (!category) return [];

  const out = new Set<string>(patternsForLabel(category.name));
  for (const item of categoryItems(category)) {
    for (const pattern of patternsForLabel(item.name)) out.add(pattern);
  }
  return [...out].slice(0, 60);
}

/**
 * LIKE patterns for one navigation subcategory, used by the shop pages to place
 * a product under a specific label ("Dining chairs", "Bar stools", …).
 */
export function subcategoryPatterns(categorySlug: string, subSlug: string): string[] {
  const sub = findSubcategory(categorySlug, subSlug);
  if (!sub) return [];
  return patternsForLabel(sub.name).slice(0, 30);
}

/** Case-insensitive substring check mirrored from the `%term%` LIKE matching. */
const contains = (needle: string) => () => needle.length > 1;

/** Does this product name plausibly belong to a navigation category? */
export function categoryMatches(name: string, slug: string): boolean {
  const lowered = name.toLowerCase();
  return categoryPatterns(slug).some((pattern) => {
    const core = pattern.replace(/^%|%$/g, "").replace(/\\/g, "").toLowerCase();
    return contains(core)() && lowered.includes(core);
  });
}

/** Does this product name plausibly belong to one navigation subcategory? */
export function subcategoryMatches(
  name: string,
  categorySlug: string,
  subSlug: string,
): boolean {
  const lowered = name.toLowerCase();
  return subcategoryPatterns(categorySlug, subSlug).some((pattern) => {
    const core = pattern.replace(/^%|%$/g, "").replace(/\\/g, "").toLowerCase();
    return contains(core)() && lowered.includes(core);
  });
}

/* -------------------------------------------------------------- the query */

/**
 * Parameter numbering, shared by the result and the count query:
 *
 *   $1  contains pattern        ('%term%')
 *   $2  term patterns           (text[] derived from the taxonomy)
 *   $3  category patterns       (text[] - only bound when `?category=` is set)
 *   then, for the result query only:
 *   $n  the raw term            (exact-match arms of the rank CASE)
 *   $n+1 prefix pattern         ('term%')
 *   $n+2 limit  ·  $n+3 offset
 *
 * The trailing four shift by one when `?category=` is absent, so every
 * placeholder is computed from the parameter list rather than hardcoded. The
 * count query reads only $1-$3 and is handed only those, because Postgres
 * fails with "could not determine data type of parameter $n" if a bound
 * parameter is never referenced by the statement.
 *
 * `rank` is a plain CASE so ordering is deterministic and needs no index and no
 * PostgreSQL extension. On a catalogue this size that is both the cheapest and
 * the correct choice; move to `pg_trgm` or a `tsvector` column once the product
 * count makes an unindexed '%term%' scan measurable.
 */
const MATCH_FILTERS = `
    (p.name ILIKE $1)
 OR (p.description ILIKE $1)
 OR (p.sku ILIKE $1)
 OR (c.name ILIKE $1)
 OR (p.name ILIKE ANY($2))
 OR EXISTS (
      SELECT 1 FROM product_variants pv
      WHERE pv.product_id = p.id
        AND (pv.variant_name ILIKE $1 OR pv.color ILIKE $1)
    )`;

const SELECT_COLUMNS = `
  SELECT
    p.id, p.name, p.slug, p.sku, p.description, p.price,
    p.category_id, p.subcategory_id, p.is_new, p.is_featured, p.stock_quantity, p.created_at,
    c.name  AS category_name,
    c.slug  AS category_slug,
    img.image_url AS image_url`;

const FROM_JOIN = `
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN LATERAL (
    SELECT pi.image_url
    FROM product_images pi
    WHERE pi.product_id = p.id
    ORDER BY pi.position ASC, pi.id ASC
    LIMIT 1
  ) img ON TRUE`;

/** Exact first, then prefix, then substring - lower is better. */
const rankCase = (term: string, prefix: string) => `
  CASE
    WHEN lower(p.name) = lower(${term})                    THEN 0
    WHEN p.sku IS NOT NULL AND lower(p.sku) = lower(${term}) THEN 0
    WHEN lower(p.name) LIKE lower(${prefix})               THEN 1
    WHEN lower(p.name) ILIKE $1                            THEN 2
    WHEN p.sku IS NOT NULL AND p.sku ILIKE $1             THEN 3
    WHEN c.name ILIKE $1                                   THEN 4
    WHEN p.name ILIKE ANY($2)                              THEN 5
    WHEN EXISTS (
      SELECT 1 FROM product_variants pv
      WHERE pv.product_id = p.id
        AND (pv.variant_name ILIKE $1 OR pv.color ILIKE $1)
    )                                                     THEN 6
    ELSE 7
  END`;

/**
 * A product row plus its computed relevance. The SQL returns every product
 * column, so this is structurally a full {@link Product}; the suggestions
 * dropdown simply ignores the surplus fields.
 */
export type SearchHit = Product & { rank: number };

export type SearchResult = {
  products: SearchHit[];
  categories: NavMatch[];
  /** Product matches only - what the /search result count reports. */
  total: number;
  /** Products plus taxonomy matches, for the "no results" fallback copy. */
  totalWithCategories: number;
};

export type SearchOptions = {
  term: string;
  /** Restrict products to one navigation category slug. */
  category?: string;
  sort?: SearchSort;
  limit?: number;
  offset?: number;
  /** Include the taxonomy matches. Off when only the product count is needed. */
  includeCategories?: boolean;
};

export function normaliseTerm(term: string | null | undefined): string {
  return (term ?? "").trim().replace(/\s+/g, " ");
}

export function isSearchable(term: string): boolean {
  return term.length >= MIN_TERM_LENGTH;
}

export async function search({
  term,
  category,
  sort = "relevance",
  limit = RESULTS_PER_PAGE,
  offset = 0,
  includeCategories = true,
}: SearchOptions): Promise<SearchResult> {
  const clean = normaliseTerm(term);

  if (!isSearchable(clean)) {
    return { products: [], categories: [], total: 0, totalWithCategories: 0 };
  }

  const categories = includeCategories ? searchNav(clean, 8) : [];

  /* $1 contains · $2 term patterns · $3 category patterns (optional) */
  const baseParams: unknown[] = [likeContains(clean), termPatterns(clean, categories)];
  let where = `WHERE ${MATCH_FILTERS}`;

  // Only bound when it will actually narrow something - an empty pattern array
  // would make `ILIKE ANY('{}')` false and silently return no rows.
  const catPatterns = category ? categoryPatterns(category) : [];
  if (catPatterns.length > 0) {
    baseParams.push(catPatterns);
    where += `\n   OR p.name ILIKE ANY($3)`;
  }

  const take = Math.min(Math.max(limit, 1), 60);
  const skip = Math.max(offset, 0);

  /* The count query reads only $1-$3, so it gets only those. */
  const [{ count }] = await query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     ${FROM_JOIN}
     ${where}`,
    baseParams,
  );

  /* Everything the result query needs on top of the shared base. */
  const at = baseParams.length + 1;
  const termParam = `$${at}`;
  const prefixParam = `$${at + 1}`;
  const limitParam = `$${at + 2}`;
  const offsetParam = `$${at + 3}`;

  const params = [...baseParams, clean, likePrefix(clean), take, skip];
  const order = SEARCH_SORTABLE[sort] ?? SEARCH_SORTABLE.relevance;

  const rows = await query<SearchHit>(
    `WITH matched AS (
       SELECT p.id, ${rankCase(termParam, prefixParam)} AS rank
       ${FROM_JOIN}
       ${where}
     )
     ${SELECT_COLUMNS}, m.rank AS rank
     FROM matched m
     JOIN products p ON p.id = m.id
     LEFT JOIN categories c ON c.id = p.category_id
     LEFT JOIN LATERAL (
       SELECT pi.image_url
       FROM product_images pi
       WHERE pi.product_id = p.id
       ORDER BY pi.position ASC, pi.id ASC
       LIMIT 1
     ) img ON TRUE
     ORDER BY ${order}
     LIMIT ${limitParam} OFFSET ${offsetParam}`,
    params,
  );

  return {
    products: rows,
    categories,
    total: Number(count),
    totalWithCategories: Number(count) + categories.length,
  };
}

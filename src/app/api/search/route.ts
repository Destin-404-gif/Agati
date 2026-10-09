import { badRequest, handleDbError, json, positiveInt } from "@/lib/api";
import {
  isSearchSort,
  isSearchable,
  MIN_TERM_LENGTH,
  normaliseTerm,
  search,
  SUGGESTION_LIMIT,
} from "@/lib/search";

export const dynamic = "force-dynamic";

/**
 * GET /api/search?q=desk&type=suggest|full&limit=&offset=&sort=&category=
 *
 * `type=suggest` (the default) caps at 8 products for the navbar dropdown.
 * `type=full` is what the /search page renders, and paginates.
 *
 * Returns 400 for a blank term or one under two characters so the client can
 * distinguish "nothing typed" from "nothing matched" and stay quiet.
 */
export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;
    const term = normaliseTerm(sp.get("q"));

    if (!isSearchable(term)) {
      return badRequest(
        sp.get("q") ? `Search needs at least ${MIN_TERM_LENGTH} characters.` : "Missing ?q=",
      );
    }

    const suggestions = sp.get("type") !== "full";
    const sortParam = sp.get("sort");
    if (sortParam && !isSearchSort(sortParam)) {
      return badRequest("Unsupported sort", { allowed: ["relevance", "price_asc", "price_desc", "newest"] });
    }

    const result = await search({
      term,
      category: sp.get("category") ?? undefined,
      sort: isSearchSort(sortParam) ? sortParam : "relevance",
      limit: suggestions ? SUGGESTION_LIMIT : positiveInt(sp.get("limit"), 24),
      offset: positiveInt(sp.get("offset"), 0),
    });

    return json({
      query: term,
      products: result.products,
      categories: result.categories,
      total: result.total,
      totalWithCategories: result.totalWithCategories,
    });
  } catch (err) {
    return handleDbError(err);
  }
}

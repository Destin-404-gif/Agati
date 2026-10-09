import { boolParam, handleDbError, json, positiveInt } from "@/lib/api";
import { getProducts } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const sp = new URL(request.url).searchParams;

    const { products, total } = await getProducts({
      category: sp.get("category") ?? undefined,
      featured: boolParam(sp.get("featured")),
      isNew: boolParam(sp.get("is_new")),
      search: sp.get("q") ?? undefined,
      sort: sp.get("sort") ?? undefined,
      limit: positiveInt(sp.get("limit"), 24),
      offset: positiveInt(sp.get("offset"), 0),
    });

    return json({ products, total, count: products.length });
  } catch (err) {
    return handleDbError(err);
  }
}

import { badRequest, handleDbError, json, notFound } from "@/lib/api";
import { query } from "@/lib/db";
import { setQuoteStatus } from "@/lib/queries";
import { QUOTE_STATUSES, type QuoteStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/quotes/[id] - move an enquiry through the workshop inbox.
 * body: { status: "new" | "replied" | "closed" }
 */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;

    const parsed = Number(id);
    if (!Number.isInteger(parsed) || parsed < 1) return badRequest("Invalid enquiry id");

    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return badRequest("Request body must be valid JSON");

    const status = typeof body.status === "string" ? body.status.trim() : "";
    if (!QUOTE_STATUSES.includes(status as QuoteStatus)) {
      return badRequest(`Status must be one of: ${QUOTE_STATUSES.join(", ")}`);
    }

    const updated = await setQuoteStatus(parsed, status as QuoteStatus);
    if (!updated) return notFound("No enquiry with that id");

    return json({ quote: updated, updated: true });
  } catch (err) {
    return handleDbError(err);
  }
}

/** GET /api/quotes/[id] - a single enquiry. */
export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;

    const parsed = Number(id);
    if (!Number.isInteger(parsed) || parsed < 1) return badRequest("Invalid enquiry id");

    const rows = await query(
      `SELECT id, name, email, phone, company, project_type, budget, timeline,
              message, product_slug, status, created_at
       FROM quote_requests WHERE id = $1`,
      [parsed],
    );

    if (!rows[0]) return notFound("No enquiry with that id");
    return json({ quote: rows[0] });
  } catch (err) {
    return handleDbError(err);
  }
}

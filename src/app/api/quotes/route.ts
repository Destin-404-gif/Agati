import { badRequest, handleDbError, json } from "@/lib/api";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

const PROJECT_TYPES = new Set([
  "Custom furniture",
  "Dining table",
  "Wall library",
  "Built-in storage",
  "Kitchen",
  "Restoration",
  "Timber supply",
  "Trade / contract",
  "Something else",
]);

const BUDGETS = new Set([
  "Under $2,000",
  "$2,000 - $8,000",
  "$8,000 - $25,000",
  "$25,000 +",
  "Not sure yet",
]);

const TIMELINES = new Set([
  "ASAP",
  "1-3 months",
  "3-6 months",
  "6+ months",
  "Just planning",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim and bound a free-text field so nobody can stuff a megabyte in. */
function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, max);
  return trimmed.length ? trimmed : null;
}

function oneOf(value: unknown, allowed: Set<string>): string | null {
  const v = str(value, 100);
  return v && allowed.has(v) ? v : null;
}

/**
 * POST /api/quotes - "Get a Quote" enquiry.
 * body: { name, email, phone?, company?, project_type?, budget?, timeline?, message?, product_slug? }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return badRequest("Request body must be valid JSON");

    const name = str(body.name, 150);
    const email = str(body.email, 255);
    const message = str(body.message, 4000);

    if (!name) return badRequest("Please tell us your name");
    if (!email) return badRequest("Please give us an email address");
    if (!EMAIL_RE.test(email)) return badRequest("That email address does not look right");
    if (!message) return badRequest("Tell us a little about the project");

    const rows = await query<{ id: number; created_at: string }>(
      `INSERT INTO quote_requests
         (name, email, phone, company, project_type, budget, timeline, message, product_slug)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, created_at`,
      [
        name,
        email,
        str(body.phone, 50),
        str(body.company, 150),
        oneOf(body.project_type, PROJECT_TYPES),
        oneOf(body.budget, BUDGETS),
        oneOf(body.timeline, TIMELINES),
        message,
        str(body.product_slug, 150),
      ],
    );

    return json({ quote: rows[0], received: true }, 201);
  } catch (err) {
    return handleDbError(err);
  }
}

/** GET /api/quotes - newest first, for the workshop inbox. */
export async function GET() {
  try {
    const rows = await query(
      `SELECT id, name, email, phone, company, project_type, budget, timeline,
              message, product_slug, status, created_at
       FROM quote_requests
       ORDER BY created_at DESC, id DESC
       LIMIT 200`,
    );
    return json({ quotes: rows, count: rows.length });
  } catch (err) {
    return handleDbError(err);
  }
}

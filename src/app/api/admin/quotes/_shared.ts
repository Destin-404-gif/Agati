import { getPool, query } from "@/lib/db";

/** Quote helpers shared by the collection route and the [id] route. */

export interface QuoteNoteRow {
  id: number;
  body: string;
  created_at: string;
  staff_name: string | null;
  staff_email: string | null;
}

export interface QuoteDetail {
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
  product_name: string | null;
  product_price: string | null;
  status: string;
  created_at: string;
  notes: QuoteNoteRow[];
}

export async function getQuoteDetail(id: number): Promise<QuoteDetail | null> {
  const rows = await query(
    `SELECT q.*, p.name AS product_name, p.price AS product_price
       FROM quote_requests q
       LEFT JOIN products p ON p.slug = q.product_slug
      WHERE q.id = $1`,
    [id],
  );

  if (rows.length === 0) return null;

  const quote = rows[0] as QuoteDetail;
  quote.notes = await listQuoteNotes(id);
  return quote;
}

export async function listQuoteNotes(quoteId: number): Promise<QuoteNoteRow[]> {
  const rows = await query(
    `SELECT n.id, n.body, n.created_at,
            s.full_name AS staff_name, s.email AS staff_email
       FROM quote_notes n
       LEFT JOIN staff_users s ON s.id = n.staff_id
      WHERE n.quote_id = $1
      ORDER BY n.created_at DESC, n.id DESC`,
    [quoteId],
  );
  return rows as QuoteNoteRow[];
}

export async function getAllQuotesForExport(): Promise<Record<string, unknown>[]> {
  const { rows } = await getPool().query(
    `SELECT id, created_at, status, name, email, phone, company, project_type,
            budget, timeline, product_slug, message
       FROM quote_requests
      ORDER BY created_at DESC, id DESC`,
  );
  return rows;
}

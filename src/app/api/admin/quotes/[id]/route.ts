import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query, getPool } from "@/lib/db";
import { QUOTE_STATUSES_ADMIN } from "@/lib/admin-nav";
import { getQuoteDetail, listQuoteNotes } from "../_shared";

export const dynamic = "force-dynamic";

const UpdateBody = z.object({
  status: z.enum(QUOTE_STATUSES_ADMIN, { message: "Pick a valid status." }),
});

const NoteBody = z.object({
  body: z.string().trim().min(1, "Write something first.").max(4000),
});

export const GET = withAuth(async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Unknown quote." }, { status: 404 });
  }

  const quote = await getQuoteDetail(id);
  if (!quote) return NextResponse.json({ error: "Unknown quote." }, { status: 404 });
  return NextResponse.json(quote);
});

export const PUT = withAuth(
  async ({ req, params, staff }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Unknown quote." }, { status: 404 });
    }

    const body = UpdateBody.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json(
        { error: body.error.issues[0]?.message ?? "Pick a valid status." },
        { status: 400 },
      );
    }

    const existing = await query("SELECT id, status FROM quote_requests WHERE id = $1", [id]);
    if (existing.length === 0) {
      return NextResponse.json({ error: "Unknown quote." }, { status: 404 });
    }

    const rows = await query(
      "UPDATE quote_requests SET status = $1 WHERE id = $2 RETURNING id, status",
      [body.data.status, id],
    );

    await logAudit({
      action: existing[0].status === body.data.status ? "update" : "status",
      entity: "quote",
      entityId: id,
      before: existing[0],
      after: rows[0],
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json({ ok: true, id, status: rows[0].status });
  },
  { permissions: ["quotes.edit"] },
);

/** Append an internal note. Notes are staff-only, never sent to the customer. */
export const POST = withAuth(
  async ({ req, params, staff }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Unknown quote." }, { status: 404 });
    }

    const body = NoteBody.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      return NextResponse.json(
        { error: body.error.issues[0]?.message ?? "Write something first." },
        { status: 400 },
      );
    }

    const exists = await query("SELECT id FROM quote_requests WHERE id = $1", [id]);
    if (exists.length === 0) {
      return NextResponse.json({ error: "Unknown quote." }, { status: 404 });
    }

    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const { rows } = await client.query(
        `INSERT INTO quote_notes (quote_id, staff_id, body) VALUES ($1,$2,$3) RETURNING *`,
        [id, staff.id, body.data.body],
      );
      await client.query("COMMIT");

      await logAudit({
        action: "note",
        entity: "quote",
        entityId: id,
        after: { note: rows[0].body },
        staff: { id: staff.id, email: staff.email },
      });

      return NextResponse.json(
        { ok: true, notes: await listQuoteNotes(id) },
        { status: 201 },
      );
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },
  { permissions: ["quotes.edit"] },
);

import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { ORDER_STATUSES } from "@/lib/admin-nav";
import { getOrderDetail } from "../_shared";

export const dynamic = "force-dynamic";

const UpdateBody = z.object({
  status: z.enum(ORDER_STATUSES, { message: "Pick a valid status." }),
  notes: z.string().max(4000).optional().default(""),
});

export const GET = withAuth(async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Unknown order." }, { status: 404 });
  }

  const order = await getOrderDetail(id);
  if (!order) {
    return NextResponse.json({ error: "Unknown order." }, { status: 404 });
  }

  return NextResponse.json(order);
});

/** Status and internal notes. Line items are immutable - they are order history. */
export const PUT = withAuth(
  async ({ req, params, staff }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Unknown order." }, { status: 404 });
    }

    const body = UpdateBody.safeParse(await req.json().catch(() => ({})));
    if (!body.success) {
      const first = body.error.issues[0];
      return NextResponse.json(
        {
          error: first?.message ?? "Please check the order.",
          fields: first?.path.length ? { [String(first.path[0])]: first.message } : undefined,
        },
        { status: 400 },
      );
    }

    const { status, notes } = body.data;

    const existing = await query(
      "SELECT id, status, notes FROM orders WHERE id = $1",
      [id],
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: "Unknown order." }, { status: 404 });
    }
    const before = existing[0];

    const rows = await query(
      "UPDATE orders SET status = $1, notes = $2 WHERE id = $3 RETURNING id, status, notes",
      [status, notes.trim() || null, id],
    );

    await logAudit({
      action: before.status === status ? "update" : "status",
      entity: "order",
      entityId: id,
      before,
      after: rows[0],
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json({ ok: true, id, status: rows[0].status });
  },
  { permissions: ["orders.edit"] },
);

import { NextResponse } from "next/server";
import { z } from "zod";
import { csvResponse, toCsv, withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { listOrders, parseListParams } from "@/lib/admin-list";
import { getPool } from "@/lib/db";
import { ORDER_STATUSES } from "@/lib/admin-nav";
import { getAllOrdersForExport } from "./_shared";

export const dynamic = "force-dynamic";

const BulkBody = z.object({
  action: z.enum(["status"]),
  ids: z.array(z.number().int().positive()).min(1).max(500),
  value: z.enum(ORDER_STATUSES),
});

export const GET = withAuth(async ({ req }) => {
  const url = new URL(req.url);

  if (url.searchParams.get("format") === "csv") {
    const rows = await getAllOrdersForExport();
    const csv = toCsv(
      [
        "id",
        "created_at",
        "status",
        "total",
        "item_count",
        "customer_name",
        "customer_email",
        "notes",
      ],
      rows,
    );
    return csvResponse(`agati-orders-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  const params = parseListParams(url.searchParams);
  return NextResponse.json(await listOrders(params));
});

/** Orders are never created or deleted from the admin; only their state changes. */
export const PATCH = withAuth(
  async ({ req, staff }) => {
    const parsed = BulkBody.safeParse(await req.json().catch(() => ({})));

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Pick a valid status and at least one order." },
        { status: 400 },
      );
    }

    const { ids, value } = parsed.data;
    const client = await getPool().connect();

    try {
      await client.query("BEGIN");

      const { rows: before } = await client.query(
        "SELECT id, status FROM orders WHERE id = ANY($1::int[]) ORDER BY id",
        [ids],
      );

      if (before.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "No matching orders." }, { status: 404 });
      }

      const found = before.map((r) => r.id as number);
      const missing = ids.filter((id) => !found.includes(id));
      const { rowCount } = await client.query(
        "UPDATE orders SET status = $1 WHERE id = ANY($2::int[])",
        [value, found],
      );

      await client.query("COMMIT");

      await logAudit({
        action: "status",
        entity: "order",
        before: { rows: before },
        after: { ids: found, status: value },
        staff: { id: staff.id, email: staff.email },
      });

      return NextResponse.json({
        ok: true,
        affected: rowCount ?? 0,
        // Report ids we did not touch so the UI can tell the user.
        missing,
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },
  { permissions: ["orders.edit"] },
);

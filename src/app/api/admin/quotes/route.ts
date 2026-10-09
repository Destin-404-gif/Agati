import { NextResponse } from "next/server";
import { z } from "zod";
import { csvResponse, toCsv, withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { listQuotes, parseListParams } from "@/lib/admin-list";
import { getPool } from "@/lib/db";
import { QUOTE_STATUSES_ADMIN } from "@/lib/admin-nav";
import { getAllQuotesForExport } from "./_shared";

export const dynamic = "force-dynamic";

const BulkBody = z.object({
  action: z.enum(["status"]),
  ids: z.array(z.number().int().positive()).min(1).max(500),
  value: z.enum(QUOTE_STATUSES_ADMIN),
});

export const GET = withAuth(async ({ req }) => {
  const url = new URL(req.url);

  if (url.searchParams.get("format") === "csv") {
    const rows = await getAllQuotesForExport();
    const csv = toCsv(
      [
        "id",
        "created_at",
        "status",
        "name",
        "email",
        "phone",
        "company",
        "project_type",
        "budget",
        "timeline",
        "product_slug",
        "message",
      ],
      rows,
    );
    return csvResponse(`agati-quotes-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return NextResponse.json(await listQuotes(parseListParams(url.searchParams)));
});

export const PATCH = withAuth(
  async ({ req, staff }) => {
    const parsed = BulkBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Pick a valid status and at least one quote." },
        { status: 400 },
      );
    }

    const { ids, value } = parsed.data;
    const client = await getPool().connect();

    try {
      await client.query("BEGIN");
      const { rows: before } = await client.query(
        "SELECT id, status FROM quote_requests WHERE id = ANY($1::int[]) ORDER BY id",
        [ids],
      );

      if (before.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json({ error: "No matching quotes." }, { status: 404 });
      }

      const found = before.map((r) => r.id as number);
      const { rowCount } = await client.query(
        "UPDATE quote_requests SET status = $1 WHERE id = ANY($2::int[])",
        [value, found],
      );
      await client.query("COMMIT");

      await logAudit({
        action: "status",
        entity: "quote",
        before: { rows: before },
        after: { ids: found, status: value },
        staff: { id: staff.id, email: staff.email },
      });

      return NextResponse.json({
        ok: true,
        affected: rowCount ?? 0,
        missing: ids.filter((id) => !found.includes(id)),
      });
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  },
  { permissions: ["quotes.edit"] },
);

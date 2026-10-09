import { NextResponse } from "next/server";
import { csvResponse, toCsv, withAuth } from "@/lib/admin-api";
import { listCustomers, parseListParams } from "@/lib/admin-list";
import { getAllCustomersForExport } from "./_shared";

export const dynamic = "force-dynamic";

export const GET = withAuth(async ({ req }) => {
  const url = new URL(req.url);

  if (url.searchParams.get("format") === "csv") {
    const csv = toCsv(
      [
        "id",
        "full_name",
        "email",
        "created_at",
        "order_count",
        "lifetime_value",
        "last_order_at",
      ],
      await getAllCustomersForExport(),
    );
    return csvResponse(
      `agati-customers-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
    );
  }

  return NextResponse.json(await listCustomers(parseListParams(url.searchParams)));
});

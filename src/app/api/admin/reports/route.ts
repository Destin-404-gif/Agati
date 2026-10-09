import { NextResponse } from "next/server";
import { withAuth } from "@/lib/admin-api";
import { getReports } from "@/lib/admin-stats";

export const dynamic = "force-dynamic";

/** Aggregated sales reports. `?days=` sets the window (7-365). */
export const GET = withAuth(
  async ({ req }) => {
    const raw = new URL(req.url).searchParams.get("days");
    const parsed = Number(raw);
    const days =
      Number.isFinite(parsed) && parsed >= 7 && parsed <= 365 ? Math.trunc(parsed) : 30;

    return NextResponse.json(await getReports(days));
  },
  { permissions: ["reports.view"] },
);

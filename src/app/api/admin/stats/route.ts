import { NextResponse } from "next/server";
import { withAuth } from "@/lib/admin-api";
import { getDashboard } from "@/lib/admin-stats";

export const dynamic = "force-dynamic";

/** Single aggregated feed for the dashboard. `?days=` controls the trend window. */
export const GET = withAuth(async ({ req }) => {
  const raw = new URL(req.url).searchParams.get("days");
  const parsed = Number(raw);
  const days =
    Number.isFinite(parsed) && parsed >= 7 && parsed <= 365 ? Math.trunc(parsed) : 30;

  const payload = await getDashboard(days);
  return NextResponse.json(payload);
});

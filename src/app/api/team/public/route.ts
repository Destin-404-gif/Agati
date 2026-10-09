import { NextResponse } from "next/server";
import { listPublicTeam } from "@/lib/team";

export const dynamic = "force-dynamic";

/**
 * The storefront roster. Public-safe columns only - name, role, job title,
 * photo and status. Phone and email never leave the admin API.
 */
export async function GET() {
  return NextResponse.json(await listPublicTeam());
}

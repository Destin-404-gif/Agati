import { NextResponse } from "next/server";
import { getNavigationData } from "@/lib/navigation-data";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getNavigationData());
}
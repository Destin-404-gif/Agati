import { NextResponse } from "next/server";
import { withAuth } from "@/lib/admin-api";
import { getCustomerDetail } from "../_shared";

export const dynamic = "force-dynamic";

export const GET = withAuth(async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Unknown customer." }, { status: 404 });
  }

  const customer = await getCustomerDetail(id);
  if (!customer) {
    return NextResponse.json({ error: "Unknown customer." }, { status: 404 });
  }
  return NextResponse.json(customer);
});

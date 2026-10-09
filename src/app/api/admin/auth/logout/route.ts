import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { toErrorResponse } from "@/lib/admin-api";
import { clientIp } from "@/lib/rate-limit";
import { clearSessionCookie, readSessionCookie, revokeSession } from "@/lib/session";
import { getCurrentStaff } from "@/lib/staff";

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  try {
    const token = await readSessionCookie();
    const staff = await getCurrentStaff();

    await revokeSession(token);
    await clearSessionCookie();

    if (staff) {
      await logAudit({
        action: "logout",
        entity: "staff",
        entityId: staff.id,
        staff: { id: staff.id, email: staff.email },
        ip,
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { toErrorResponse } from "@/lib/admin-api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { newResetToken } from "@/lib/session";
import { findStaffByEmail } from "@/lib/staff";
import { query } from "@/lib/db";

const Body = z.object({ email: z.email("Enter a valid email address.") });

const RESET_TTL_MINUTES = 30;

/**
 * Always answers the same way so the endpoint cannot be used to discover which
 * email addresses have staff accounts. Without SMTP configured the reset link
 * is written to the server log instead of being emailed.
 */
export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  try {
    const { email } = Body.parse(await req.json());
    const key = email.toLowerCase();

    const limit = rateLimit(`forgot:${key}:${ip ?? "unknown"}`, 5, 15 * 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { ok: true, message: "If that account exists, a reset link is on its way." },
        { status: 202 },
      );
    }

    const staff = await findStaffByEmail(key);

    if (staff && staff.isActive) {
      const { token, hash } = newResetToken();
      await query(
        `INSERT INTO password_resets (staff_id, token_hash, expires_at)
         VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
        [staff.id, hash, String(RESET_TTL_MINUTES)],
      );
      await query(
        "UPDATE password_resets SET used_at = NOW() WHERE staff_id = $1 AND used_at IS NULL",
        [staff.id],
      );
      await logAudit({
        action: "password_reset",
        entity: "staff",
        entityId: staff.id,
        after: { requested: true },
        staff: { id: staff.id, email: staff.email },
        ip,
      });

      const link = `/admin/reset-password?token=${token}`;
      console.log(
        `\n[auth] password reset for ${staff.email}\n[auth] ${link} (valid ${RESET_TTL_MINUTES} min)\n`,
      );
    }

    return NextResponse.json(
      { ok: true, message: "If that account exists, a reset link is on its way." },
      { status: 202 },
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { toErrorResponse } from "@/lib/admin-api";
import { hashPassword, passwordProblem } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import {
  hashToken,
  issueSession,
  setSessionCookie,
} from "@/lib/session";

const Body = z.object({
  token: z.string().min(10, "That reset link is not valid."),
  password: z.string().min(1, "Choose a password."),
});

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  try {
    const { token, password } = Body.parse(await req.json());

    const limit = rateLimit(`reset:${ip ?? "unknown"}`, 10, 15 * 60_000);
    if (!limit.ok) {
      return NextResponse.json(
        { error: "Too many attempts. Try again later." },
        { status: 429 },
      );
    }

    const problem = passwordProblem(password);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const rows = await query<{ id: number; staff_id: number; email: string }>(
      `SELECT pr.id, pr.staff_id, s.email
         FROM password_resets pr
         JOIN staff_users s ON s.id = pr.staff_id
        WHERE pr.token_hash = $1
          AND pr.used_at IS NULL
          AND pr.expires_at > NOW()
          AND s.is_active = TRUE`,
      [hashToken(token)],
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "That reset link has expired or has already been used." },
        { status: 400 },
      );
    }

    const { staff_id, email } = rows[0];

    await query("UPDATE staff_users SET password_hash = $1 WHERE id = $2", [
      await hashPassword(password),
      staff_id,
    ]);
    await query("UPDATE password_resets SET used_at = NOW() WHERE id = $1", [
      rows[0].id,
    ]);
    // Force every other device to sign in again.
    await query("DELETE FROM sessions WHERE staff_id = $1", [staff_id]);

    const sessionToken = await issueSession(
      { staffId: staff_id, email, fullName: null, role: null },
      { ip, userAgent: req.headers.get("user-agent") },
    );
    await setSessionCookie(sessionToken);

    await logAudit({
      action: "password_reset",
      entity: "staff",
      entityId: staff_id,
      after: { completed: true },
      staff: { id: staff_id, email },
      ip,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return toErrorResponse(err);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { toErrorResponse } from "@/lib/admin-api";
import { verifyPassword } from "@/lib/password";
import {
  clientIp,
  rateLimit,
  recordLoginAttempt,
} from "@/lib/rate-limit";
import { query } from "@/lib/db";
import { issueSession, setSessionCookie } from "@/lib/session";
import { findStaffByLogin, touchLogin } from "@/lib/staff";

/**
 * Admin sign-in.
 *
 * The form has one field, so `identifier` accepts either the username or the
 * email address. Failure messages are deliberately uniform: a caller must not
 * be able to learn whether an account exists, whether it is suspended, or
 * whether the password was close.
 */

const Body = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Enter your username or email address.")
    .max(255, "That is too long."),
  password: z.string().min(1, "Enter your password."),
  // "Keep me signed in" trades session lifetime for convenience. It is opt-in.
  remember: z.boolean().optional(),
});

const INVALID = "That username or password is incorrect.";

/** Failed attempts before an identity is locked out. */
const MAX_ACCOUNT_FAILURES = 5;
/** How long that lockout lasts. */
const LOCKOUT_MINUTES = 15;

/** Seconds until the lockout expires, 0 when the account is not locked. */
async function lockoutSeconds(email: string): Promise<number> {
  const rows = await query<{ seconds: string }>(
    `SELECT EXTRACT(EPOCH FROM (
              NOW() - MIN(created_at)
            ) + ($2 || ' minutes')::interval) AS seconds
       FROM login_attempts
      WHERE LOWER(email) = LOWER($1)
        AND success = FALSE
        AND created_at > NOW() - ($2 || ' minutes')::interval
      HAVING COUNT(*) >= $3`,
    [email, String(LOCKOUT_MINUTES), MAX_ACCOUNT_FAILURES],
  );
  const seconds = Number(rows[0]?.seconds ?? 0);
  return seconds > 0 ? Math.ceil(seconds) : 0;
}

export async function POST(req: Request) {
  const ip = clientIp(req.headers);
  const userAgent = req.headers.get("user-agent");

  try {
    const { identifier, password, remember } = Body.parse(await req.json());
    const key = identifier.toLowerCase();

    // Per-IP ceiling in memory: cheap, and it stops an attacker rotating
    // usernames from hammering the password verifier at all. It is generous
    // because an office, a school or a mobile carrier can put many real admins
    // behind one address; the per-account lockout below is the real defence.
    const byIp = rateLimit(`login:ip:${ip ?? "unknown"}`, 100, 15 * 60_000);
    if (!byIp.ok) {
      await recordLoginAttempt(key, ip, false);
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${Math.ceil(byIp.retryAfterSeconds / 60)} minutes.` },
        { status: 429, headers: { "retry-after": String(byIp.retryAfterSeconds) } },
      );
    }

    // The account lockout lives in PostgreSQL, not in process memory, for two
    // reasons: it survives a restart or redeploy, and the recovery script can
    // clear it. An in-memory counter here would keep locking the account out
    // long after the password was reset.
    const locked = await lockoutSeconds(key);
    if (locked > 0) {
      await recordLoginAttempt(key, ip, false);
      return NextResponse.json(
        {
          error: `Too many failed attempts. Try again in ${Math.ceil(locked / 60)} minutes, or reset your password.`,
        },
        { status: 429, headers: { "retry-after": String(locked) } },
      );
    }

    const staff = await findStaffByLogin(identifier);
    const ok = staff ? await verifyPassword(password, staff.passwordHash) : false;

    // A suspended account, an invited account with no real password, a wrong
    // password and an unknown handle all produce the same response, and all
    // still cost a hash comparison where an account exists.
    const usable = staff !== null && staff.status === "active";
    if (!staff || !ok || !usable) {
      await recordLoginAttempt(key, ip, false);
      await logAudit({
        action: "login_failed",
        entity: "staff",
        entityId: staff?.id ?? null,
        staff: staff ? { id: staff.id, email: staff.email } : null,
        ip,
      });
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }

    const token = await issueSession(
      {
        staffId: staff.id,
        email: staff.email,
        fullName: staff.fullName,
        role: staff.role,
      },
      { ip, userAgent, remember: remember === true },
    );
    await setSessionCookie(token, remember === true);
    await touchLogin(staff.id);
    await recordLoginAttempt(key, ip, true);

    /* A success wipes the failure history so the account starts clean, and
       leaves no window during which old failures could re-lock it. */
    await query("DELETE FROM login_attempts WHERE LOWER(email) = LOWER($1)", [key]);
    await logAudit({
      action: "login",
      entity: "staff",
      entityId: staff.id,
      staff: { id: staff.id, email: staff.email },
      ip,
    });

    return NextResponse.json({
      ok: true,
      // No forced password change: the account is seeded from .env.local and
      // the same password is expected to keep working.
      staff: {
        id: staff.id,
        username: staff.username,
        email: staff.email,
        fullName: staff.fullName,
        role: staff.role,
        roleName: staff.roleName,
        permissions: staff.permissions,
      },
    });
  } catch (err) {
    return toErrorResponse(err);
  }
}
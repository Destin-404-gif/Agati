import { NextResponse } from "next/server";
import { z } from "zod";
import { toErrorResponse, withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { findPasswordHashForStaff, setStaffPassword } from "@/lib/staff";

export const dynamic = "force-dynamic";

/**
 * Change your own password.
 *
 * This is the endpoint the forced first-login change posts to, so it is the one
 * place that has to work when the only credential the person holds is the
 * seeded default. It requires the current password - the forced change is not a
 * password reset, and must not be usable by anyone who finds a live session.
 */

const Body = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(1, "Choose a new password."),
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    path: ["newPassword"],
    message: "Choose a password you have not used here before.",
  });

export const POST = withAuth(async ({ req, staff }) => {
  const ip = clientIp(req.headers);

  // A tight ceiling: changing a password is not something a person does often,
  // and a burst of attempts from a hijacked session is worth stopping.
  const limit = rateLimit(`pwchange:${staff.id}`, 8, 15 * 60_000);
  if (!limit.ok) {
    return NextResponse.json(
      {
        error: `Too many attempts. Try again in ${Math.ceil(limit.retryAfterSeconds / 60)} minutes.`,
      },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const { currentPassword, newPassword } = Body.parse(await req.json());

  const problem = passwordProblem(newPassword);
  if (problem) {
    return NextResponse.json(
      { error: problem, fields: [{ path: "newPassword", message: problem }] },
      { status: 400 },
    );
  }

  const stored = await findPasswordHashForStaff(staff.id);
  if (!stored) {
    return NextResponse.json({ error: "Sign in again to continue." }, { status: 401 });
  }

  if (!(await verifyPassword(currentPassword, stored))) {
    await logAudit({
      action: "password_change_failed",
      entity: "staff",
      entityId: staff.id,
      staff: { id: staff.id, email: staff.email },
      ip,
    });
    return NextResponse.json(
      {
        error: "That is not your current password.",
        fields: [{ path: "currentPassword", message: "That is not your current password." }],
      },
      { status: 400 },
    );
  }

  await setStaffPassword(staff.id, await hashPassword(newPassword));

  await logAudit({
    action: "password_change",
    entity: "staff",
    entityId: staff.id,
    staff: { id: staff.id, email: staff.email },
    ip,
  });

  return NextResponse.json({ ok: true });
});
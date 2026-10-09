import { NextResponse } from "next/server";
import { withAuth, readJson } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import {
  getTeamMember,
  nextStatus,
  teamStatusSchema,
  type TeamStatus,
} from "@/lib/team";

export const dynamic = "force-dynamic";

function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Flip one member between Working / Off duty / On leave.
 *
 * Send `{ status }` to set it explicitly, or an empty body to cycle to the
 * next one - that is what the quick toggle on the card does.
 */
export const PATCH = withAuth<{ id: string }>(
  async ({ req, params, staff }) => {
    const id = parseId(params.id);
    if (id === null) {
      return NextResponse.json({ error: "Unknown team member." }, { status: 404 });
    }

    const before = await getTeamMember(id);
    if (!before) {
      return NextResponse.json({ error: "Unknown team member." }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as { status?: unknown };
    let status: TeamStatus;

    if (body.status === undefined || body.status === null || body.status === "") {
      status = nextStatus(before.status);
    } else {
      const parsed = teamStatusSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.issues[0]?.message ?? "Pick a valid status." },
          { status: 400 },
        );
      }
      status = parsed.data.status;
    }

    const rows = await query<{ status: TeamStatus }>(
      `UPDATE team_members SET status = $2
        WHERE id = $1
        RETURNING status`,
      [id, status],
    );

    await logAudit({
      action: "update",
      entity: "team_member",
      entityId: id,
      before: { status: before.status },
      after: { status },
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json({ ok: true, id, status: rows[0].status });
  },
  { permissions: ["staff.edit"] },
);

import { NextResponse } from "next/server";
import { withAuth, readJson } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { removeStoredFiles } from "@/lib/media-upload";
import {
  getTeamMember,
  ownerExists,
  teamMemberSchema,
  textOrNull,
} from "@/lib/team";

export const dynamic = "force-dynamic";

function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Full save of one member. The admin modal always sends every field. */
export const PUT = withAuth<{ id: string }>(
  async ({ req, params, staff }) => {
    const id = parseId(params.id);
    if (id === null) {
      return NextResponse.json({ error: "Unknown team member." }, { status: 404 });
    }

    const before = await getTeamMember(id);
    if (!before) {
      return NextResponse.json({ error: "Unknown team member." }, { status: 404 });
    }

    const data = await readJson(req, teamMemberSchema);

    if (data.role === "owner" && before.role !== "owner" && (await ownerExists(id))) {
      return NextResponse.json(
        { error: "There can only be one owner. Edit the existing owner instead." },
        { status: 400 },
      );
    }

    const rows = await query(
      `UPDATE team_members
          SET full_name = $2, role = $3, job_title = $4, phone = $5, email = $6,
              status = $7, is_active = $8, sort_order = $9
        WHERE id = $1
        RETURNING id, full_name, role, job_title, phone, email, photo_url,
                  status, is_active, sort_order, created_at, updated_at`,
      [
        id,
        data.fullName,
        data.role,
        textOrNull(data.jobTitle),
        textOrNull(data.phone),
        textOrNull(data.email),
        data.status,
        data.isActive,
        data.sortOrder,
      ],
    );

    await logAudit({
      action: "update",
      entity: "team_member",
      entityId: id,
      before: { role: before.role, status: before.status, is_active: before.is_active },
      after: { role: rows[0].role, status: rows[0].status, is_active: rows[0].is_active },
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json(rows[0]);
  },
  { permissions: ["staff.edit"] },
);

/**
 * Remove a member and the photo bytes they owned. The owner is protected -
 * the business always has exactly one.
 */
export const DELETE = withAuth<{ id: string }>(
  async ({ params, staff }) => {
    const id = parseId(params.id);
    if (id === null) {
      return NextResponse.json({ error: "Unknown team member." }, { status: 404 });
    }

    const before = await getTeamMember(id);
    if (!before) {
      return NextResponse.json({ error: "Unknown team member." }, { status: 404 });
    }

    if (before.role === "owner") {
      return NextResponse.json(
        { error: "The owner cannot be deleted." },
        { status: 400 },
      );
    }

    await query("DELETE FROM team_members WHERE id = $1", [id]);
    if (before.photo_url) await removeStoredFiles([before.photo_url]);

    await logAudit({
      action: "delete",
      entity: "team_member",
      entityId: id,
      before: { full_name: before.full_name, role: before.role },
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json({ ok: true, id });
  },
  { permissions: ["staff.edit"] },
);

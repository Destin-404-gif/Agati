import { NextResponse } from "next/server";
import { withAuth, readJson } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { listTeam, ownerExists, teamMemberSchema, textOrNull } from "@/lib/team";

export const dynamic = "force-dynamic";

/**
 * The full roster, always ordered Owner -> Administrators -> Workers, then by
 * sort order and name inside each group. Admin-only: it includes phone/email.
 */
export const GET = withAuth(async () => {
  return NextResponse.json(await listTeam());
});

/**
 * Add a member. There can only ever be one owner, enforced here and again by
 * the partial unique index in migration 013.
 */
export const POST = withAuth(
  async ({ req, staff }) => {
    const data = await readJson(req, teamMemberSchema);

    if (data.role === "owner" && (await ownerExists())) {
      return NextResponse.json(
        { error: "There can only be one owner. Edit the existing owner instead." },
        { status: 400 },
      );
    }

    const rows = await query(
      `INSERT INTO team_members (full_name, role, job_title, phone, email, status, is_active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, full_name, role, job_title, phone, email, photo_url,
                 status, is_active, sort_order, created_at, updated_at`,
      [
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
      action: "create",
      entity: "team_member",
      entityId: rows[0].id,
      after: { full_name: data.fullName, role: data.role },
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json(rows[0], { status: 201 });
  },
  { permissions: ["staff.edit"] },
);

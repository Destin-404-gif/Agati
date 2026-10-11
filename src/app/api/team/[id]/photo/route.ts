import { NextResponse } from "next/server";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { imageUrlProblem, normalizeImageUrl } from "@/lib/image-link";
import { getTeamMember } from "@/lib/team";

export const dynamic = "force-dynamic";

function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Attach or clear a member's photo.
 *
 * `POST` takes `{ url }` JSON - a pasted https image link, stored as a string,
 * so it needs no disk and survives a redeploy. `DELETE` clears the photo.
 */
export const POST = withAuth<{ id: string }>(
  async ({ req, params, staff }) => {
    const id = parseId(params.id);
    if (id === null) {
      return NextResponse.json({ error: "Unknown team member." }, { status: 404 });
    }

    const existing = await getTeamMember(id);
    if (!existing) {
      return NextResponse.json({ error: "Unknown team member." }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as { url?: unknown };
    const candidate = typeof body.url === "string" ? body.url : "";
    const problem = imageUrlProblem(candidate);
    if (problem) {
      return NextResponse.json({ error: problem }, { status: 400 });
    }
    const photoUrl = normalizeImageUrl(candidate);

    const updated = await query<{ id: number; photo_url: string | null }>(
      `UPDATE team_members SET photo_url = $2
        WHERE id = $1
        RETURNING id, photo_url`,
      [id, photoUrl],
    );

    const replaced = existing.photo_url;

    await logAudit({
      action: "update",
      entity: "team_member",
      entityId: id,
      before: { photo_url: replaced },
      after: { photo_url: photoUrl },
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json({
      ok: true,
      ...updated[0],
      url: photoUrl,
      thumbUrl: photoUrl,
    });
  },
  { permissions: ["staff.edit"] },
);

export const DELETE = withAuth<{ id: string }>(
  async ({ params, staff }) => {
    const id = parseId(params.id);
    if (id === null) {
      return NextResponse.json({ error: "Unknown team member." }, { status: 404 });
    }

    const existing = await getTeamMember(id);
    if (!existing) {
      return NextResponse.json({ error: "Unknown team member." }, { status: 404 });
    }

    await query(`UPDATE team_members SET photo_url = NULL WHERE id = $1`, [id]);

    await logAudit({
      action: "update",
      entity: "team_member",
      entityId: id,
      before: { photo_url: existing.photo_url },
      after: { photo_url: null },
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json({ ok: true, id });
  },
  { permissions: ["staff.edit"] },
);

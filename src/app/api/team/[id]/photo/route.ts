import { NextResponse } from "next/server";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { removeStoredFiles, storeUpload } from "@/lib/media-upload";
import { getTeamMember } from "@/lib/team";

export const dynamic = "force-dynamic";

function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * Attach or clear a member's photo.
 *
 * `POST` takes multipart `file`, runs it through the shared sharp pipeline -
 * re-encoded as high-quality WebP (never below q90), no heavy compression -
 * and stores the 1200px variant, which is sharp on a retina screen without
 * shipping a 4K file to every visitor. `DELETE` clears the photo and removes
 * the bytes.
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

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }

    // `null` slotKey means "a photo": jpg/png/webp only, never an SVG.
    const result = await storeUpload(file, null, staff.email);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const photoUrl = result.upload.variant1200Url ?? result.upload.url;

    const updated = await query<{ id: number; photo_url: string | null }>(
      `UPDATE team_members SET photo_url = $2
        WHERE id = $1
        RETURNING id, photo_url`,
      [id, photoUrl],
    );

    const replaced = existing.photo_url;
    if (replaced && replaced !== photoUrl) {
      await removeStoredFiles([replaced]);
    }

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
      url: result.upload.url,
      thumbUrl: result.upload.thumbUrl,
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
    if (existing.photo_url) await removeStoredFiles([existing.photo_url]);

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

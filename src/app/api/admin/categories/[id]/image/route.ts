import { NextResponse } from "next/server";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { removeStoredFiles, storeUpload } from "@/lib/media-upload";
import { revalidateTaxonomy } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

/**
 * Attach or clear a category picture.
 *
 * `POST` takes a multipart upload (`file`, optional `alt`), runs it through the
 * shared `storeUpload` handler - 5MB cap, magic-byte sniff, jpeg/png/webp only,
 * re-encode, thumbnail - then points the category at the new file and deletes
 * the file it replaced. `DELETE` clears the picture and removes the file.
 *
 * Admin-only (`products.edit`), same-origin enforced by the CSRF check in
 * `src/proxy.ts`, and every value reaches Postgres as a bound parameter.
 */

async function loadCategory(id: number) {
  const rows = await query<{ id: number; name: string; image_url: string | null }>(
    `SELECT id, name, image_url FROM categories WHERE id = $1`,
    [id],
  );
  return rows[0] ?? null;
}

function parseId(raw: string | undefined): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const POST = withAuth<{ id: string }>(
  async ({ req, params, staff }) => {
    const id = parseId(params.id);
    if (id === null) {
      return NextResponse.json({ error: "Unknown category." }, { status: 404 });
    }

    const existing = await loadCategory(id);
    if (!existing) {
      return NextResponse.json({ error: "Unknown category." }, { status: 404 });
    }

    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }

    // `null` slotKey means "a photo": SVG is not accepted here, only jpg/png/webp.
    const result = await storeUpload(file, null, staff.email);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const altField = form?.get("alt");
    const alt = typeof altField === "string" ? altField.trim().slice(0, 300) : null;

    const updated = await query<{ id: number; image_url: string | null; image_alt: string | null }>(
      `UPDATE categories
          SET image_url = $2,
              image_alt = COALESCE($3, image_alt)
        WHERE id = $1
        RETURNING id, image_url, image_alt`,
      [id, result.upload.url, alt === "" ? null : alt],
    );

    // The picture this one replaced is now unreferenced; remove its bytes.
    const replaced = existing.image_url;
    if (replaced && replaced !== result.upload.url) {
      await removeStoredFiles([replaced]);
    }

    await logAudit({
      action: "update",
      entity: "category",
      entityId: id,
      before: { image_url: replaced },
      after: { image_url: result.upload.url, bytes: result.upload.bytes },
      staff: { id: staff.id, email: staff.email },
    });

    revalidateTaxonomy();

    return NextResponse.json({
      ok: true,
      ...updated[0],
      url: result.upload.url,
      thumbUrl: result.upload.thumbUrl,
      width: result.upload.width,
      height: result.upload.height,
      bytes: result.upload.bytes,
    });
  },
  { permissions: ["products.edit"] },
);

export const DELETE = withAuth<{ id: string }>(
  async ({ params, staff }) => {
    const id = parseId(params.id);
    if (id === null) {
      return NextResponse.json({ error: "Unknown category." }, { status: 404 });
    }

    const existing = await loadCategory(id);
    if (!existing) {
      return NextResponse.json({ error: "Unknown category." }, { status: 404 });
    }

    await query(
      `UPDATE categories SET image_url = NULL, image_alt = NULL WHERE id = $1`,
      [id],
    );

    if (existing.image_url) await removeStoredFiles([existing.image_url]);

    await logAudit({
      action: "update",
      entity: "category",
      entityId: id,
      before: { image_url: existing.image_url },
      after: { image_url: null },
      staff: { id: staff.id, email: staff.email },
    });

    revalidateTaxonomy();

    return NextResponse.json({ ok: true, id });
  },
  { permissions: ["products.edit"] },
);
import { NextResponse } from "next/server";
import { z } from "zod";
import { readJson, withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { deleteUpload, storeUpload } from "@/lib/media-upload";

export const dynamic = "force-dynamic";

/**
 * The media library endpoint.
 *
 * `POST` accepts an admin image upload. The file is validated and re-encoded by
 * `storeUpload`, which also writes a thumbnail and registers the file in
 * `media_uploads`. Passing `slot` lets the route know whether an SVG is
 * acceptable (the logo and favicon take one; a product photo does not).
 *
 * `DELETE` removes a file from the library. The library is a separate store from
 * the slot table, so a file can be uploaded and then assigned; deleting one that
 * a slot still points at is refused - clear the slot first.
 */

const bodySchema = z.object({ id: z.coerce.number().int().positive() });

export const POST = withAuth(
  async ({ req, staff }) => {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    const slotField = form?.get("slot");
    const slotKey = typeof slotField === "string" && slotField ? slotField : null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }

    const result = await storeUpload(file, slotKey, staff.email);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { upload } = result;

    await logAudit({
      action: "create",
      entity: "upload",
      entityId: upload.filename,
      after: {
        url: upload.url,
        bytes: upload.bytes,
        width: upload.width,
        height: upload.height,
        mime: upload.mime,
      },
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json({
      ok: true,
      // `id` is included so a client that just uploaded can delete it again
      // without first re-listing the library.
      id: upload.id,
      url: upload.url,
      thumbUrl: upload.thumbUrl,
      originalName: upload.originalName,
      mime: upload.mime,
      bytes: upload.bytes,
      width: upload.width,
      height: upload.height,
      originalWidth: upload.originalWidth,
      originalHeight: upload.originalHeight,
      variants: upload.variants,
      quality: upload.qualityTier,
    });
  },
  { permissions: ["media.edit", "content.edit", "products.edit"] },
);

export const DELETE = withAuth(
  async ({ req, staff }) => {
    const { id } = await readJson(req, bodySchema);

    const result = await deleteUpload(id);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    await logAudit({
      action: "delete",
      entity: "upload",
      entityId: String(id),
      after: { id },
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json({ ok: true });
  },
  { permissions: ["media.edit", "content.edit"] },
);
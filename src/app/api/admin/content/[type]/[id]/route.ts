import { NextResponse } from "next/server";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import {
  contentColumns,
  contentInput,
  isContentType,
  listContent,
  type ContentType,
} from "../../_shared";

export const dynamic = "force-dynamic";

export const PUT = withAuth(
  async ({ req, params, staff }) => {
    const type = params.type as string;
    if (!isContentType(type)) {
      return NextResponse.json({ error: "Unknown content type." }, { status: 400 });
    }

    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Unknown item." }, { status: 404 });
    }

    const parsed = contentInput.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Check the fields." },
        { status: 400 },
      );
    }

    if (parsed.data.type !== type) {
      return NextResponse.json(
        { error: "The body type does not match the route." },
        { status: 400 },
      );
    }

    const before = await query(
      `SELECT * FROM ${type} WHERE id = $1`,
      [id],
    );
    if (before.length === 0) {
      return NextResponse.json({ error: "Unknown item." }, { status: 404 });
    }

    const cols = contentColumns(type as ContentType, parsed.data.body as Record<string, unknown>);

    if (type === "pages") {
      const clash = await query("SELECT id FROM pages WHERE slug = $1 AND id <> $2", [
        cols.slug,
        id,
      ]);
      if (clash.length > 0) {
        return NextResponse.json(
          { error: "A page already uses that slug." },
          { status: 409 },
        );
      }
    }

    const keys = Object.keys(cols);
    const sets = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
    const rows = await query(
      `UPDATE ${type} SET ${sets} WHERE id = $${keys.length + 1} RETURNING id, title`,
      [...Object.values(cols), id],
    );

    await logAudit({
      action: "update",
      entity: type.replace(/s$/, ""),
      entityId: id,
      before: before[0],
      after: { type, body: cols },
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json(rows[0]);
  },
  { permissions: ["content.edit"] },
);

export const DELETE = withAuth(
  async ({ params, staff }) => {
    const type = params.type as string;
    if (!isContentType(type)) {
      return NextResponse.json({ error: "Unknown content type." }, { status: 400 });
    }

    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Unknown item." }, { status: 404 });
    }

    const before = await query(`SELECT * FROM ${type} WHERE id = $1`, [id]);
    if (before.length === 0) {
      return NextResponse.json({ error: "Unknown item." }, { status: 404 });
    }

    await query(`DELETE FROM ${type} WHERE id = $1`, [id]);

    await logAudit({
      action: "delete",
      entity: type.replace(/s$/, ""),
      entityId: id,
      before: before[0],
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json({ ok: true, id });
  },
  { permissions: ["content.edit"] },
);

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
} from "./_shared";

export const dynamic = "force-dynamic";

export const GET = withAuth(
  async ({ req }) => {
    const type = new URL(req.url).searchParams.get("type") ?? "banners";
    if (!isContentType(type)) {
      return NextResponse.json({ error: "Unknown content type." }, { status: 400 });
    }
    return NextResponse.json({ rows: await listContent(type as ContentType) });
  },
  { permissions: ["content.edit"] },
);

export const POST = withAuth(
  async ({ req, staff }) => {
    const parsed = contentInput.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Check the fields." },
        { status: 400 },
      );
    }

    const { type, body } = parsed.data;
    const cols = contentColumns(type, body as Record<string, unknown>);
    const keys = Object.keys(cols);
    const values = Object.values(cols);

    if (type === "pages") {
      const clash = await query("SELECT id FROM pages WHERE slug = $1", [cols.slug]);
      if (clash.length > 0) {
        return NextResponse.json(
          { error: "A page already uses that slug." },
          { status: 409 },
        );
      }
    }

    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
    const rows = await query(
      `INSERT INTO ${type} (${keys.join(", ")})
       VALUES (${placeholders}) RETURNING id, title`,
      values,
    );

    await logAudit({
      action: "create",
      entity: type.replace(/s$/, ""),
      entityId: rows[0].id,
      after: { type, body: cols },
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json(rows[0], { status: 201 });
  },
  { permissions: ["content.edit"] },
);

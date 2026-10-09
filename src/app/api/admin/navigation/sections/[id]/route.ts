import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { revalidateNavigation } from "@/lib/revalidate";
import { slugify } from "@/lib/admin-schemas";

const SectionBody = z.object({
  groupLabel: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  icon: z.string().trim().min(1).max(80),
  image: z.string().trim().max(2000).optional().or(z.literal("")),
  sortOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
});

export const PATCH = withAuth<{ id: string }>(
  async ({ req, params, staff }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Unknown section." }, { status: 404 });
    const parsed = SectionBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the fields." }, { status: 400 });
    const data = parsed.data;
    const slug = slugify(data.slug || data.name);
    const before = await query("SELECT * FROM mega_menu_sections WHERE id = $1", [id]);
    if (!before.length) return NextResponse.json({ error: "Unknown section." }, { status: 404 });
    const rows = await query(
      `UPDATE mega_menu_sections SET group_label=$1, name=$2, slug=$3,
         description=$4, icon=$5, image=$6, sort_order=$7, is_active=$8
       WHERE id=$9
       RETURNING id, nav_item_id, group_label, name, slug, description, icon, image, sort_order, is_active`,
      [data.groupLabel, data.name, slug, data.description || null, data.icon, data.image || null, data.sortOrder, data.isActive, id],
    );
    await logAudit({ action: "update", entity: "mega_menu_section", entityId: id, before: before[0], after: rows[0], staff: { id: staff.id, email: staff.email } });
    revalidateNavigation();
    return NextResponse.json(rows[0]);
  },
  { permissions: ["products.edit"] },
);

export const DELETE = withAuth<{ id: string }>(
  async ({ params, staff }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Unknown section." }, { status: 404 });
    const before = await query("DELETE FROM mega_menu_sections WHERE id = $1 RETURNING *", [id]);
    if (!before.length) return NextResponse.json({ error: "Unknown section." }, { status: 404 });
    await logAudit({ action: "delete", entity: "mega_menu_section", entityId: id, before: before[0], staff: { id: staff.id, email: staff.email } });
    revalidateNavigation();
    return NextResponse.json({ ok: true });
  },
  { permissions: ["products.edit"] },
);
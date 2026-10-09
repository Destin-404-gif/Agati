import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { revalidateNavigation } from "@/lib/revalidate";
import { slugify } from "@/lib/admin-schemas";

const ItemBody = z.object({
  navbar: z.enum(["top_bar", "category_bar"]),
  label: z.string().trim().min(1).max(100),
  slug: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  icon: z.string().trim().min(1).max(80),
  hasMegaMenu: z.boolean(),
  sortOrder: z.number().int().min(0).max(9999),
  isActive: z.boolean(),
});

export const PATCH = withAuth<{ id: string }>(
  async ({ req, params, staff }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Unknown menu item." }, { status: 404 });
    const parsed = ItemBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the fields." }, { status: 400 });
    const data = parsed.data;
    const slug = slugify(data.slug || data.label);
    const before = await query("SELECT * FROM nav_items WHERE id = $1", [id]);
    if (!before.length) return NextResponse.json({ error: "Unknown menu item." }, { status: 404 });
    const rows = await query(
      `UPDATE nav_items SET navbar=$1, label=$2, slug=$3, description=$4, icon=$5,
         has_mega_menu=$6, sort_order=$7, is_active=$8
       WHERE id=$9
       RETURNING id, navbar, label, slug, description, icon, has_mega_menu, sort_order, is_active`,
      [data.navbar, data.label, slug, data.description || null, data.icon, data.hasMegaMenu, data.sortOrder, data.isActive, id],
    );
    await logAudit({ action: "update", entity: "nav_item", entityId: id, before: before[0], after: rows[0], staff: { id: staff.id, email: staff.email } });
    revalidateNavigation();
    return NextResponse.json(rows[0]);
  },
  { permissions: ["products.edit"] },
);

export const DELETE = withAuth<{ id: string }>(
  async ({ params, staff }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) return NextResponse.json({ error: "Unknown menu item." }, { status: 404 });
    const before = await query("DELETE FROM nav_items WHERE id = $1 RETURNING *", [id]);
    if (!before.length) return NextResponse.json({ error: "Unknown menu item." }, { status: 404 });
    await logAudit({ action: "delete", entity: "nav_item", entityId: id, before: before[0], staff: { id: staff.id, email: staff.email } });
    revalidateNavigation();
    return NextResponse.json({ ok: true });
  },
  { permissions: ["products.edit"] },
);
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { revalidateNavigation } from "@/lib/revalidate";
import { slugify } from "@/lib/admin-schemas";

const SectionBody = z.object({
  navItemId: z.number().int().positive(),
  groupLabel: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(100),
  slug: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  icon: z.string().trim().min(1).max(80).default("Package"),
  image: z.string().trim().max(2000).optional().or(z.literal("")),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export const POST = withAuth(
  async ({ req, staff }) => {
    const parsed = SectionBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the fields." }, { status: 400 });
    const data = parsed.data;
    const slug = slugify(data.slug || data.name);
    const rows = await query(
      `INSERT INTO mega_menu_sections
         (nav_item_id, group_label, name, slug, description, icon, image, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, nav_item_id, group_label, name, slug, description, icon, image, sort_order, is_active`,
      [data.navItemId, data.groupLabel, data.name, slug, data.description || null, data.icon, data.image || null, data.sortOrder, data.isActive],
    );
    await query("UPDATE nav_items SET has_mega_menu = TRUE WHERE id = $1", [data.navItemId]);
    await logAudit({ action: "create", entity: "mega_menu_section", entityId: rows[0].id, after: rows[0], staff: { id: staff.id, email: staff.email } });
    revalidateNavigation();
    return NextResponse.json(rows[0], { status: 201 });
  },
  { permissions: ["products.edit"] },
);
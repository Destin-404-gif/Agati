import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { getNavigationData } from "@/lib/navigation-data";
import { revalidateNavigation } from "@/lib/revalidate";
import { slugify } from "@/lib/admin-schemas";

export const dynamic = "force-dynamic";

const ItemBody = z.object({
  navbar: z.enum(["top_bar", "category_bar"]),
  label: z.string().trim().min(1).max(100),
  slug: z.string().trim().optional().or(z.literal("")),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  icon: z.string().trim().min(1).max(80).default("Package"),
  hasMegaMenu: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

export const GET = withAuth(async () =>
  NextResponse.json(await getNavigationData(true)),
  { permissions: ["products.view"] },
);

export const POST = withAuth(
  async ({ req, staff }) => {
    const parsed = ItemBody.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the fields." }, { status: 400 });
    }
    const data = parsed.data;
    const slug = slugify(data.slug || data.label);
    if (!slug) return NextResponse.json({ error: "Add a valid menu item name." }, { status: 400 });

    const rows = await query(
      `INSERT INTO nav_items (navbar, label, slug, description, icon, has_mega_menu, sort_order, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id, navbar, label, slug, description, icon, has_mega_menu, sort_order, is_active`,
      [data.navbar, data.label, slug, data.description || null, data.icon, data.hasMegaMenu, data.sortOrder, data.isActive],
    );
    await logAudit({ action: "create", entity: "nav_item", entityId: rows[0].id, after: rows[0], staff: { id: staff.id, email: staff.email } });
    revalidateNavigation();
    return NextResponse.json({ ...rows[0], sections: [] }, { status: 201 });
  },
  { permissions: ["products.edit"] },
);
import { NextResponse } from "next/server";
import { z } from "zod";
import { csvResponse, toCsv, withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { query } from "@/lib/db";
import { listCategories, parseListParams } from "@/lib/admin-list";
import { categoryInput, toCategoryCsv } from "./_shared";

export const dynamic = "force-dynamic";

export const GET = withAuth(async ({ req }) => {
  const url = new URL(req.url);

  if (url.searchParams.get("format") === "csv") {
    const csv = toCsv(
      ["id", "name", "slug", "image_url", "image_alt", "created_at", "product_count"],
      await query(toCategoryCsv()),
    );
    return csvResponse(
      `agati-categories-${new Date().toISOString().slice(0, 10)}.csv`,
      csv,
    );
  }

  return NextResponse.json(await listCategories(parseListParams(url.searchParams)));
});

export const POST = withAuth(
  async ({ req, staff }) => {
    const parsed = categoryInput.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Check the fields." },
        { status: 400 },
      );
    }

    const { name, slug, image_url, image_alt } = parsed.data;
    const cleanSlug = slug.trim().toLowerCase();

    const clash = await query("SELECT id FROM categories WHERE slug = $1", [cleanSlug]);
    if (clash.length > 0) {
      return NextResponse.json(
        { error: "That slug is already used by another category." },
        { status: 409 },
      );
    }

    const rows = await query(
      `INSERT INTO categories (name, slug, image_url, image_alt)
       VALUES ($1,$2,$3,$4) RETURNING id, name, slug, image_url, image_alt`,
      [name.trim(), cleanSlug, image_url || null, image_alt || null],
    );

    await logAudit({
      action: "create",
      entity: "category",
      entityId: rows[0].id,
      after: rows[0],
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json(rows[0], { status: 201 });
  },
  { permissions: ["products.edit"] },
);

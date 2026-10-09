import { NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { query } from "@/lib/db";
import { listRoles, listStaff, parseListParams } from "@/lib/admin-list";
import { staffCreate } from "./_shared";

export const dynamic = "force-dynamic";

export const GET = withAuth(async ({ req }) => {
  const url = new URL(req.url);

  if (url.searchParams.get("include") === "roles") {
    return NextResponse.json({ roles: await listRoles() });
  }

  return NextResponse.json(await listStaff(parseListParams(url.searchParams)));
});

export const POST = withAuth(
  async ({ req, staff }) => {
    const parsed = staffCreate.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Check the fields." },
        { status: 400 },
      );
    }

    const email = parsed.data.email.toLowerCase();
    const existing = await query("SELECT id FROM staff_users WHERE email = $1", [email]);
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "A staff member with that email already exists." },
        { status: 409 },
      );
    }

    const roles = await listRoles();
    const roleSlug = parsed.data.role_slug ?? "staff";
    const role = roles.find((r) => r.slug === roleSlug);
    if (!role) {
      return NextResponse.json({ error: "Unknown role." }, { status: 400 });
    }

    const password_hash = await hashPassword(parsed.data.password);    const rows = await query(
      `INSERT INTO staff_users (email, password_hash, full_name, role_id, is_active)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, email, full_name, role_id, is_active, last_login_at, created_at`,
      [
        email,
        password_hash,
        parsed.data.full_name || null,
        role.id,
        parsed.data.is_active,
      ],
    );

    await logAudit({
      action: "create",
      entity: "staff",
      entityId: rows[0].id,
      after: { email, role: role.slug, is_active: parsed.data.is_active },
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json(rows[0], { status: 201 });
  },
  { permissions: ["staff.edit"] },
);

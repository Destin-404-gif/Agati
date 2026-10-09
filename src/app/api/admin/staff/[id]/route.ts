import { NextResponse } from "next/server";
import { withAuth } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { clearPermissionCache } from "@/lib/staff";
import { query } from "@/lib/db";
import { listRoles } from "@/lib/admin-list";
import { staffPatch } from "../_shared";

export const dynamic = "force-dynamic";

export const GET = withAuth(async ({ params }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: "Unknown staff member." }, { status: 404 });
  }

  const rows = await query(
    `SELECT s.id, s.email, s.full_name, s.role_id, r.name AS role_name,
            r.slug AS role_slug, s.is_active, s.last_login_at, s.created_at
       FROM staff_users s LEFT JOIN roles r ON r.id = s.role_id
      WHERE s.id = $1`,
    [id],
  );
  if (rows.length === 0) {
    return NextResponse.json({ error: "Unknown staff member." }, { status: 404 });
  }
  return NextResponse.json(rows[0]);
});

export const PATCH = withAuth(
  async ({ req, params, staff }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Unknown staff member." }, { status: 404 });
    }

    const before = await query("SELECT * FROM staff_users WHERE id = $1", [id]);
    if (before.length === 0) {
      return NextResponse.json({ error: "Unknown staff member." }, { status: 404 });
    }

    const parsed = staffPatch.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Check the fields." },
        { status: 400 },
      );
    }

    const { email, full_name, role_slug, is_active, password } = parsed.data;

    /* Guard rails: never lock everyone out of the admin. */
    const roles = await listRoles();
    const target = roles.find((r) => r.slug === role_slug);
    const superAdmin = roles.find((r) => r.slug === "super_admin");

    if (id === staff.id && is_active === false) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account." },
        { status: 400 },
      );
    }

    if (id === staff.id && superAdmin && role_slug && role_slug !== "super_admin") {
      return NextResponse.json(
        { error: "You cannot remove your own Super Admin role." },
        { status: 400 },
      );
    }

    if (superAdmin && superAdmin.staff_count <= 1 && (role_slug === "super_admin") === false) {
      const isLast = before[0].role_id === superAdmin.id;
      if (isLast) {
        return NextResponse.json(
          { error: "The last Super Admin cannot be demoted." },
          { status: 400 },
        );
      }
    }

    if (email) {
      const clash = await query(
        "SELECT id FROM staff_users WHERE email = $1 AND id <> $2",
        [email.toLowerCase(), id],
      );
      if (clash.length > 0) {
        return NextResponse.json(
          { error: "A staff member with that email already exists." },
          { status: 409 },
        );
      }
    }

    const sets: string[] = [];
    const args: unknown[] = [];
    const add = (col: string, value: unknown) => {
      args.push(value);
      sets.push(`${col} = $${args.length}`);
    };

    if (email !== undefined) add("email", email.toLowerCase());
    if (full_name !== undefined) add("full_name", full_name || null);
    if (is_active !== undefined) add("is_active", is_active);
    if (target) add("role_id", target.id);
    if (password) add("password_hash", await hashPassword(password));

    if (sets.length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    args.push(id);
    const rows = await query(
      `UPDATE staff_users SET ${sets.join(", ")}
        WHERE id = $${args.length}
        RETURNING id, email, full_name, role_id, is_active, last_login_at, created_at`,
      args,
    );

    /* A role or password change must not be served from a stale cache. */
    if (target || password) clearPermissionCache();

    await logAudit({
      action: "update",
      entity: "staff",
      entityId: id,
      before: {
        email: before[0].email,
        role_id: before[0].role_id,
        is_active: before[0].is_active,
      },
      after: {
        email: rows[0].email,
        role_id: rows[0].role_id,
        is_active: rows[0].is_active,
        password_changed: Boolean(password),
      },
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json(rows[0]);
  },
  { permissions: ["staff.edit"] },
);

export const DELETE = withAuth(
  async ({ params, staff }) => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1) {
      return NextResponse.json({ error: "Unknown staff member." }, { status: 404 });
    }

    if (id === staff.id) {
      return NextResponse.json(
        { error: "You cannot delete your own account." },
        { status: 400 },
      );
    }

    const before = await query("SELECT * FROM staff_users WHERE id = $1", [id]);
    if (before.length === 0) {
      return NextResponse.json({ error: "Unknown staff member." }, { status: 404 });
    }

    const roles = await listRoles();
    const superAdmin = roles.find((r) => r.slug === "super_admin");
    if (superAdmin && before[0].role_id === superAdmin.id && superAdmin.staff_count <= 1) {
      return NextResponse.json(
        { error: "The last Super Admin cannot be deleted." },
        { status: 400 },
      );
    }

    /* Sessions and password resets cascade via the schema. */
    await query("DELETE FROM staff_users WHERE id = $1", [id]);

    await logAudit({
      action: "delete",
      entity: "staff",
      entityId: id,
      before: { email: before[0].email, role_id: before[0].role_id },
      staff: { id: staff.id, email: staff.email },
    });

    return NextResponse.json({ ok: true, id });
  },
  { permissions: ["staff.edit"] },
);

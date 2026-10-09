import { query, type QueryResultRow } from "./db";
import {
  readSessionCookie,
  readSession,
  type StaffRole,
  type StaffStatus,
} from "./session";

export interface Staff {
  id: number;
  email: string;
  username: string;
  fullName: string | null;
  roleId: number | null;
  role: StaffRole | null;
  roleName: string | null;
  status: StaffStatus;
  isActive: boolean;
  lastLoginAt: string | null;
}

export interface StaffWithPermissions extends Staff {
  permissions: string[];
}

export class AuthError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "AuthError";
  }
}

interface StaffRow extends QueryResultRow {
  id: number;
  email: string;
  username: string | null;
  full_name: string | null;
  role_id: number | null;
  role: string | null;
  role_name: string | null;
  status: string | null;
  is_active: boolean | null;
  last_login_at: string | null;
}

const STAFF_COLUMNS = `
  s.id, s.email, s.username, s.full_name, s.role_id, s.status, s.is_active,
  s.last_login_at,
  r.slug AS role, r.name AS role_name
`;

function toStaff(row: StaffRow): Staff {
  // `status` is the source of truth; `is_active` predates it and is kept in
  // sync by a trigger. Reading `is_active` as well means a row written before
  // the status column existed still resolves correctly.
  const status: StaffStatus =
    (row.status as StaffStatus | null) ??
    (row.is_active === false ? "suspended" : "active");

  return {
    id: row.id,
    email: row.email,
    username: row.username ?? "",
    fullName: row.full_name,
    roleId: row.role_id,
    role: (row.role as StaffRole | null) ?? null,
    roleName: row.role_name,
    status,
    isActive: status === "active",
    lastLoginAt: row.last_login_at
      ? new Date(row.last_login_at).toISOString()
      : null,
  };
}

export async function findStaffById(
  id: number,
): Promise<StaffWithPermissions | null> {
  const rows = await query<StaffRow>(
    `SELECT ${STAFF_COLUMNS}
       FROM staff_users s
       LEFT JOIN roles r ON r.id = s.role_id
      WHERE s.id = $1`,
    [id],
  );
  if (rows.length === 0) return null;

  const staff = toStaff(rows[0]);
  return { ...staff, permissions: await permissionsForRole(staff.roleId) };
}

export async function findStaffByEmail(
  email: string,
): Promise<(StaffWithPermissions & { passwordHash: string }) | null> {
  const rows = await query<StaffRow & { password_hash: string }>(
    `SELECT ${STAFF_COLUMNS}, s.password_hash
       FROM staff_users s
       LEFT JOIN roles r ON r.id = s.role_id
      WHERE LOWER(s.email) = LOWER($1)`,
    [email],
  );
  if (rows.length === 0) return null;

  const staff = toStaff(rows[0]);
  return {
    ...staff,
    passwordHash: rows[0].password_hash,
    permissions: await permissionsForRole(staff.roleId),
  };
}

/**
 * Look an account up by either handle.
 *
 * The login field is a single box, so both are accepted here: a person signing
 * in types the username they were given or the email address the account was
 * created with. Both comparisons are case-insensitive, matching the unique
 * index on `username`.
 */
export async function findStaffByLogin(
  identifier: string,
): Promise<(StaffWithPermissions & { passwordHash: string }) | null> {
  const rows = await query<StaffRow & { password_hash: string }>(
    `SELECT ${STAFF_COLUMNS}, s.password_hash
       FROM staff_users s
       LEFT JOIN roles r ON r.id = s.role_id
      WHERE LOWER(s.username) = LOWER($1)
         OR LOWER(s.email) = LOWER($1)
      -- If one value matches an email and another matches a username, the
      -- username wins: it is the more specific handle.
      ORDER BY (LOWER(s.username) = LOWER($1)) DESC
      LIMIT 1`,
    [identifier],
  );
  if (rows.length === 0) return null;

  const staff = toStaff(rows[0]);
  return {
    ...staff,
    passwordHash: rows[0].password_hash,
    permissions: await permissionsForRole(staff.roleId),
  };
}

/**
 * The stored password hash, for the flows that must verify a password the person
 * already has. Deliberately separate from `findStaffById`, which feeds session
 * payloads and must never carry the hash around.
 */
export async function findPasswordHashForStaff(
  staffId: number,
): Promise<string | null> {
  const rows = await query<{ password_hash: string }>(
    `SELECT password_hash FROM staff_users WHERE id = $1`,
    [staffId],
  );
  return rows[0]?.password_hash ?? null;
}

/** Update the password in one statement. Used by the profile and recovery flows. */
export async function setStaffPassword(
  staffId: number,
  passwordHash: string,
): Promise<void> {
  await query(
    `UPDATE staff_users
        SET password_hash = $2, status = 'active'
      WHERE id = $1`,
    [staffId, passwordHash],
  );
}

/** Stamp a successful sign-in, used by the login route and the dashboard shell. */
export async function touchLogin(staffId: number): Promise<void> {
  await query("UPDATE staff_users SET last_login_at = NOW() WHERE id = $1", [staffId]);
}

// Permission lookups change rarely; cache them briefly so every request does not
// re-run a join. Cleared on any role/permission write.
const CACHE_TTL_MS = 30_000;
const permCache = new Map<number, { keys: string[]; at: number }>();

export function clearPermissionCache(): void {
  permCache.clear();
}

export async function permissionsForRole(
  roleId: number | null,
): Promise<string[]> {
  if (roleId === null) return [];

  const hit = permCache.get(roleId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.keys;

  const rows = await query<{ key: string }>(
    `SELECT p.key
       FROM role_permissions rp
       JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY p.key`,
    [roleId],
  );
  const keys = rows.map((r) => r.key);
  permCache.set(roleId, { keys, at: Date.now() });
  return keys;
}

/** The signed-in staff member, or null when there is no valid session. */
export async function getCurrentStaff(): Promise<StaffWithPermissions | null> {
  const token = await readSessionCookie();
  const staffId = await readSession(token);
  if (staffId === null) return null;

  const staff = await findStaffById(staffId);
  if (!staff || !staff.isActive) return null;
  return staff;
}

export async function requireStaff(): Promise<StaffWithPermissions> {
  const staff = await getCurrentStaff();
  if (!staff) throw new AuthError(401, "Sign in to continue.");
  return staff;
}

export function isSuperAdmin(staff: Staff): boolean {
  return staff.role === "super-admin";
}

export async function requireRole(
  ...roles: StaffRole[]
): Promise<StaffWithPermissions> {
  const staff = await requireStaff();
  if (isSuperAdmin(staff)) return staff;
  if (!staff.role || !roles.includes(staff.role)) {
    throw new AuthError(403, "You do not have access to this area.");
  }
  return staff;
}

/**
 * Throws unless the staff member holds at least one of `keys`.
 * Super Admin implicitly holds every permission.
 */
export async function requirePermission(
  ...keys: string[]
): Promise<StaffWithPermissions> {
  const staff = await requireStaff();
  if (isSuperAdmin(staff)) return staff;
  if (keys.length === 0) return staff;

  if (!staff.permissions.some((p) => keys.includes(p))) {
    throw new AuthError(403, "You do not have permission to do that.");
  }
  return staff;
}

export function can(
  staff: StaffWithPermissions | null,
  ...keys: string[]
): boolean {
  if (!staff) return false;
  if (isSuperAdmin(staff)) return true;
  const held = staff.permissions;
  return keys.some((k) => held.includes(k));
}

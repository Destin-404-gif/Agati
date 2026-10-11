#!/usr/bin/env node
/**
 * Idempotent admin seed / recovery. Safe to run on every deploy.
 *
 *   npm run seed:admin
 *
 * Reads ADMIN_USERNAME, ADMIN_EMAIL and ADMIN_PASSWORD from the environment
 * (falling back to .env.local / .env locally). Env vars supplied by the platform
 * always win, so the same command works on Render without a file.
 *
 * What it does, in order:
 *   1. Applies db/admin-schema.sql (idempotent) so the tables, roles and the
 *      retired forced-change columns exist/converge on a fresh database.
 *   2. Ensures the `super-admin` role exists.
 *   3. Upserts ONE account matched by username OR email (case-insensitive):
 *        - resets the password hash to ADMIN_PASSWORD
 *        - role = super-admin
 *        - status = 'active' (and the legacy is_active mirror)
 *        - clears any forced-change flag and lockout counters
 *   4. Leaves every other account, role and row untouched.
 *
 * The plain password is never logged. Re-running it is a no-op apart from
 * re-setting the same password, which is the point.
 */
import { readFileSync, existsSync } from "node:fs";
import { randomBytes, scrypt as _scrypt } from "node:crypto";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Client } from "pg";

const scrypt = promisify(_scrypt);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Platform env vars take precedence; only read local files when DATABASE_URL is
// still missing (i.e. running on a dev machine).
for (const file of [".env.local", ".env"]) {
  if (process.env.DATABASE_URL) break;
  const full = path.join(root, file);
  if (existsSync(full)) {
    process.loadEnvFile(full);
    console.log(`  loaded ${file}`);
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error(
    "\n  DATABASE_URL is not set. Point it at the target Postgres, e.g.\n" +
      '    $env:DATABASE_URL="postgresql://..."; npm run seed:admin\n',
  );
  process.exit(1);
}

const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
let username = (process.env.ADMIN_USERNAME ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";

if (!email) {
  console.error("\n  ADMIN_EMAIL is required.\n");
  process.exit(1);
}
if (!username) {
  // Same derivation the schema trigger uses when no handle is supplied.
  username = email.split("@")[0].replace(/[^a-z0-9._-]/g, "");
}
if (!password) {
  console.error("\n  ADMIN_PASSWORD is required.\n");
  process.exit(1);
}

/** Identical format to src/lib/password.ts: `scrypt$N$r$p$salt$key`. */
async function hashPassword(plain) {
  const salt = randomBytes(16);
  const key = await scrypt(plain.normalize("NFKC"), salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt$16384$8$1$${salt.toString("hex")}$${key.toString("hex")}`;
}

const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
})();
const isLocal = /^(localhost|127\.0\.0\.1|::1)$/i.test(host);

const client = new Client({
  connectionString: url,
  // Render's external endpoint requires TLS; localhost does not.
  ssl: process.env.PGSSL === "true" || !isLocal ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  console.log(`\n  connected to ${host}\n`);

  // 1. Guarantee the admin schema. Idempotent; also drops the retired
  //    must_change_password / password_expires_at columns on an old database.
  const schema = readFileSync(path.join(root, "db", "admin-schema.sql"), "utf8");
  process.stdout.write("  → admin-schema.sql ... ");
  await client.query(schema);
  console.log("done");

  // 2. Guarantee the super-admin role.
  const role = await client.query(
    `INSERT INTO roles (name, slug, description)
     VALUES ('Super Admin', 'super-admin', 'Full access to every part of the admin.')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
  );
  const roleId = role.rows[0].id;

  // 3. Upsert the single account. A username match is preferred over an email
  //    match, mirroring the login query.
  const found = await client.query(
    `SELECT id FROM staff_users
      WHERE LOWER(username) = $1 OR LOWER(email) = $2
      ORDER BY (LOWER(username) = $1) DESC
      LIMIT 1`,
    [username, email],
  );

  const passwordHash = await hashPassword(password);
  const fullName = process.env.ADMIN_NAME ?? "Super Admin";

  let staffId;
  let action;
  if (found.rowCount > 0) {
    staffId = found.rows[0].id;
    await client.query(
      `UPDATE staff_users
          SET username = $2,
              email = $3,
              password_hash = $4,
              full_name = COALESCE(NULLIF(full_name, ''), $5),
              role_id = $6,
              status = 'active',
              is_active = TRUE,
              updated_at = NOW()
        WHERE id = $1`,
      [staffId, username, email, passwordHash, fullName, roleId],
    );
    action = "updated";
  } else {
    const inserted = await client.query(
      `INSERT INTO staff_users
         (email, username, password_hash, full_name, role_id, status, is_active)
       VALUES ($1, $2, $3, $4, $5, 'active', TRUE)
       RETURNING id`,
      [email, username, passwordHash, fullName, roleId],
    );
    staffId = inserted.rows[0].id;
    action = "created";
  }

  // 4. Clear this identity's lockout history so the new password works at once.
  await client.query(
    `DELETE FROM login_attempts
      WHERE LOWER(email) = LOWER($1) OR LOWER(email) = LOWER($2)`,
    [email, username],
  );

  console.log(`\n  ✓ admin ${action}: ${username} <${email}> (id ${staffId})`);
  console.log("    role=super-admin · status=active · lockout cleared");
  console.log("    password set from ADMIN_PASSWORD (not shown)\n");
} catch (err) {
  console.error(`\n  FAILED: ${err.message}\n`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

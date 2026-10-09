#!/usr/bin/env node
/**
 * Applies db/admin-schema.sql and seeds roles, permissions and a Super Admin.
 *
 *   npm run db:admin      apply + seed (idempotent)
 *   npm run db:admin:schema   apply SQL only
 *   npm run db:admin:seed     seed only
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { Client } from "pg";

const scrypt = promisify(_scrypt);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

for (const file of [".env.local", ".env"]) {
  const full = path.join(root, file);
  if (existsSync(full)) {
    process.loadEnvFile(full);
    console.log(`  loaded ${file}`);
    break;
  }
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("\nDATABASE_URL is not set. Copy .env.example to .env.local first.\n");
  process.exit(1);
}

const PERMISSIONS = [
  ["dashboard.view", "View the admin dashboard"],
  ["products.view", "View products"],
  ["products.edit", "Create, update and delete products"],
  ["orders.view", "View orders"],
  ["orders.edit", "Update order status and details"],
  ["customers.view", "View customers"],
  ["customers.edit", "Edit customer records"],
  ["quotes.view", "View quote requests"],
  ["quotes.edit", "Update quotes and add notes"],
  ["content.edit", "Manage banners, pages and announcements"],
  ["media.edit", "Upload and replace site images"],
  ["reports.view", "View reports and analytics"],
  ["staff.view", "View staff and roles"],
  ["staff.edit", "Create staff and assign roles"],
  ["settings.edit", "Change site settings"],
];

const ROLES = [
  {
    slug: "super-admin",
    name: "Super Admin",
    description: "Full access to every part of the admin.",
    all: true,
  },
  {
    slug: "admin",
    name: "Admin",
    description: "Manages the catalogue, orders, customers and quotes.",
    all: false,
    permissions: [
      "dashboard.view",
      "products.view",
      "products.edit",
      "orders.view",
      "orders.edit",
      "customers.view",
      "customers.edit",
      "quotes.view",
      "quotes.edit",
      "content.edit",
      "media.edit",
      "reports.view",
    ],
  },
  {
    slug: "editor",
    name: "Editor",
    description:
      "Runs the storefront: images, banners and pages. No orders, staff or settings.",
    all: false,
    permissions: [
      "dashboard.view",
      "products.view",
      "content.edit",
      "media.edit",
    ],
  },
  {
    slug: "staff",
    name: "Staff",
    description: "Day-to-day order and quote handling. Read-only catalogue.",
    all: false,
    permissions: [
      "dashboard.view",
      "products.view",
      "orders.view",
      "orders.edit",
      "customers.view",
      "quotes.view",
      "quotes.edit",
    ],
  },
];

/**
 * The login handle for the seeded super admin. Defaults to the local part of
 * ADMIN_EMAIL so it matches the backfill the schema trigger does for accounts
 * that predate usernames.
 */
function defaultUsername(email) {
  return (
    process.env.ADMIN_USERNAME ?? email.split("@")[0].toLowerCase()
  ).replace(/[^a-z0-9._-]/g, "");
}

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

/** Compare a candidate against a stored `scrypt$N$r$p$salt$key` hash. */
async function verifyPassword(plain, stored) {
  try {
    const [scheme, N, r, p, saltHex, keyHex] = stored.split("$");
    if (scheme !== "scrypt") return false;
    const salt = Buffer.from(saltHex, "hex");
    const expected = Buffer.from(keyHex, "hex");
    if (expected.length === 0) return false;
    const key = await scrypt(plain.normalize("NFKC"), salt, expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
      maxmem: 64 * 1024 * 1024,
    });
    return timingSafeEqual(key, expected);
  } catch {
    return false;
  }
}

const mode = process.argv[2] ?? "all";
const runSchema = mode === "all" || mode === "schema";
const runSeed = mode === "all" || mode === "seed";

const client = new Client({
  connectionString: url,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();
  console.log(`\n  connected to ${new URL(url).host}\n`);

  if (runSchema) {
    const sql = await readFile(path.join(root, "db", "admin-schema.sql"), "utf8");
    process.stdout.write("  → admin-schema.sql ... ");
    await client.query(sql);
    console.log("done");
  }

  if (runSeed) {
    for (const [key, description] of PERMISSIONS) {
      await client.query(
        `INSERT INTO permissions (key, description) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description`,
        [key, description],
      );
    }

    for (const role of ROLES) {
      const { rows } = await client.query(
        `INSERT INTO roles (name, slug, description) VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name,
                                          description = EXCLUDED.description
         RETURNING id`,
        [role.name, role.slug, role.description],
      );
      const roleId = rows[0].id;
      const keys = role.all
        ? PERMISSIONS.map(([k]) => k)
        : (role.permissions ?? []);

      for (const key of keys) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           SELECT $1, id FROM permissions WHERE key = $2
           ON CONFLICT DO NOTHING`,
          [roleId, key],
        );
      }
    }

    const email = (process.env.ADMIN_EMAIL ?? "admin@agati.com").toLowerCase();
    const username = defaultUsername(email);
    const existing = await client.query(
      "SELECT id, username, password_hash FROM staff_users WHERE email = $1",
      [email],
    );

    if (existing.rowCount > 0) {
      // The account is left otherwise untouched — this must never reset a
      // password an admin has since changed. Only the handle is filled in, for
      // accounts created before usernames existed.
      const row = existing.rows[0];
      if (!row.username) {
        await client.query("UPDATE staff_users SET username = $2 WHERE id = $1", [
          row.id,
          username,
        ]);
        console.log(`  → gave ${email} the username “${username}”`);
      } else {
        console.log(`  → super admin ${email} already exists (left untouched)`);
      }
      console.log(
        `      password unchanged — restart and redeploy will not reset it\n`,
      );
    } else {
      const generated = !process.env.ADMIN_PASSWORD;
      const password = process.env.ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");
      const fullName = process.env.ADMIN_NAME ?? "Super Admin";
      const { rows: roleRows } = await client.query(
        "SELECT id FROM roles WHERE slug = 'super-admin'",
      );

      // One fixed password: seeded once from ADMIN_PASSWORD and never flagged
      // for replacement, so this same password keeps working for the life of
      // the account.
      await client.query(
        `INSERT INTO staff_users
           (email, username, password_hash, full_name, role_id, status, is_active)
         VALUES ($1, $2, $3, $4, $5, 'active', TRUE)`,
        [email, username, await hashPassword(password), fullName, roleRows[0].id],
      );

      console.log(`\n  → created super admin`);
      console.log(`      username: ${username}`);
      console.log(`      email:    ${email}`);
      console.log(`      password: ${password}`);
      console.log(
        `      This is the fixed admin password. It is never flagged for change.\n`,
      );
      if (generated) {
        console.log("    set ADMIN_PASSWORD in .env.local to control it.\n");
      }
    }
  }

  const { rows } = await client.query(`
    SELECT (SELECT COUNT(*)::int FROM staff_users)      AS staff,
           (SELECT COUNT(*)::int FROM roles)            AS roles,
           (SELECT COUNT(*)::int FROM permissions)      AS permissions,
           (SELECT COUNT(*)::int FROM audit_logs)       AS audits
  `);
  const r = rows[0];
  console.log(
    `\n  ${r.staff} staff · ${r.roles} roles · ${r.permissions} permissions · ${r.audits} audit entries\n`,
  );
} catch (err) {
  console.error(`\n  FAILED: ${err.message}\n`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

#!/usr/bin/env node
/**
 * One-off recovery: replace a staff super admin with a fresh one.
 *
 * Creates a new super-admin account with a generated password and deletes the
 * old account, in a single transaction. sessions/password_resets cascade away;
 * audit_logs, quote notes and chat references are kept with NULL staff_id.
 *
 * It deliberately does NOT read DATABASE_URL from .env.local, so it can never
 * run against the local database by accident. Pass the Render *External*
 * Database URL explicitly:
 *
 *   node scripts/replace-super-admin.mjs --url "postgresql://..." \
 *        --delete-email admin@agati.com
 *
 * Optional: --username <name> --email <addr> --password <plain> --delete
 *
 * Pass --delete=false to keep the old account (suspended instead).
 */
import { randomBytes, scrypt as _scrypt } from "node:crypto";
import { promisify } from "node:util";
import { Client } from "pg";

const scrypt = promisify(_scrypt);

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const url = arg("url") ?? process.env.PROD_DATABASE_URL;
if (!url) {
  console.error(
    "\n  Pass the Render External Database URL with --url \"postgresql://...\"\n",
  );
  process.exit(1);
}

const host = (() => {
  try {
    return new URL(url).hostname;
  } catch {
    console.error("\n  That --url is not a valid connection string.\n");
    process.exit(1);
  }
})();

if (/^(localhost|127\.0\.0\.1|::1)$/i.test(host)) {
  console.error(`\n  Refusing to run against ${host}. Pass the production URL.\n`);
  process.exit(1);
}

const deleteArg = arg("delete");
const deleteOld = deleteArg === undefined ? true : deleteArg !== "false";
const deleteEmail = (arg("delete-email") ?? "admin@agati.com").toLowerCase();
const username = (arg("username") ?? "superadmin").toLowerCase();
const email = (arg("email") ?? "superadmin@agati.com").toLowerCase();
const fullName = arg("name") ?? "Super Admin";

/** Same format as src/lib/password.ts: `scrypt$N$r$p$salt$key`. */
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

const password = arg("password") ?? randomBytes(18).toString("base64url");

const client = new Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

try {
  await client.connect();
  console.log(`\n  connected to ${host}\n`);

  await client.query("BEGIN");

  const role = await client.query(
    "SELECT id FROM roles WHERE slug = 'super-admin'",
  );
  if (role.rowCount === 0) {
    throw new Error(
      "no 'super-admin' role — run `npm run db:admin:schema` against this DB first",
    );
  }

  const clash = await client.query(
    `SELECT id FROM staff_users
      WHERE LOWER(username) = $1 OR LOWER(email) = $2`,
    [username, email],
  );
  if (clash.rowCount > 0) {
    throw new Error(
      `username “${username}” or email “${email}” already exists — pass --username/--email`,
    );
  }

  const before = await client.query(
    `SELECT id, username, email FROM staff_users ORDER BY id`,
  );
  console.log("  before:");
  for (const r of before.rows) {
    console.log(`    ${r.id}  ${r.username.padEnd(18)} ${r.email}`);
  }

  const created = await client.query(
    `INSERT INTO staff_users
       (email, username, password_hash, full_name, role_id, status, is_active)
     VALUES ($1, $2, $3, $4, $5, 'active', TRUE)
     RETURNING id`,
    [email, username, await hashPassword(password), fullName, role.rows[0].id],
  );

  let oldAction = "nothing";
  const old = await client.query(
    "SELECT id, username, email FROM staff_users WHERE LOWER(email) = $1 AND id <> $2",
    [deleteEmail, created.rows[0].id],
  );
  if (old.rowCount > 0) {
    if (deleteOld) {
      for (const r of old.rows) {
        await client.query("DELETE FROM staff_users WHERE id = $1", [r.id]);
        await client.query(
          "DELETE FROM login_attempts WHERE LOWER(email) = LOWER($1)",
          [r.email],
        );
        console.log(`  deleted old account ${r.id} (${r.email})`);
      }
      oldAction = "deleted";
    } else {
      for (const r of old.rows) {
        await client.query(
          "UPDATE staff_users SET status = 'suspended' WHERE id = $1",
          [r.id],
        );
      }
      oldAction = "suspended";
    }
  } else {
    console.log(`  no account with email ${deleteEmail} to remove`);
  }

  await client.query("COMMIT");

  const after = await client.query(
    `SELECT s.id, s.username, s.email, s.status, r.name AS role
       FROM staff_users s LEFT JOIN roles r ON r.id = s.role_id
      ORDER BY s.id`,
  );
  console.log("\n  after:");
  for (const r of after.rows) {
    console.log(`    ${r.id}  ${r.username.padEnd(18)} ${r.email.padEnd(30)} ${r.status}  ${r.role ?? "no role"}`);
  }

  console.log("\n  === New super admin credentials ===");
  console.log(`    username: ${username}`);
  console.log(`    email:    ${email}`);
  console.log(`    password: ${password}`);
  console.log(`    old account: ${oldAction}`);
  console.log("\n  Change the password after signing in.\n");
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`\n  FAILED: ${err.message}\n`);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}

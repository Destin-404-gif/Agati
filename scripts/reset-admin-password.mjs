#!/usr/bin/env node
/**
 * Recovery path for a forgotten admin password.
 *
 * Sets the password for one account straight in the database, without going
 * near the login form. Everything else about the account is left alone: role,
 * status, sessions and audit history are untouched.
 *
 *   node scripts/reset-admin-password.mjs --username admin
 *   node scripts/reset-admin-password.mjs --email admin@agati.com --password "newpass"
 *
 * With no --password it prompts without echo. With no --username/--email it
 * lists the accounts so you can pick one.
 */
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import readline from "node:readline";
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
  console.error("\n  DATABASE_URL is not set. Copy .env.example to .env.local first.\n");
  process.exit(1);
}

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const username = arg("username");
const email = arg("email");
const passwordArg = arg("password");

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

/** Read a secret without echoing it. */
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const onData = (char) => {
      if (["\n", "\r", ""].includes(String(char))) process.stdin.removeListener("data", onData);
      else process.stdout.write("\b \b");
    };
    process.stdin.on("data", onData);
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const client = new Client({
  connectionString: url,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
});

try {
  await client.connect();

  if (!username && !email) {
    const { rows } = await client.query(
      `SELECT s.id, s.username, s.email, s.status, r.name AS role
         FROM staff_users s
         LEFT JOIN roles r ON r.id = s.role_id
        ORDER BY s.id`,
    );
    console.log("\n  Admin accounts:\n");
    for (const row of rows) {
      console.log(`    ${row.id}  ${row.username.padEnd(16)} ${row.email.padEnd(28)} ${row.status}  ${row.role ?? "no role"}`);
    }
    console.log("\n  Re-run with --username <name> or --email <address> to reset one.\n");
    await client.end();
    process.exit(0);
  }

  const column = username ? "username" : "email";
  const value = (username ?? email).toLowerCase();
  const target = await client.query(
    `SELECT id, username, email FROM staff_users WHERE LOWER(${column}) = $1`,
    [value],
  );

  if (target.rowCount === 0) {
    console.error(`\n  No account matches ${column} “${value}”.\n`);
    await client.end();
    process.exit(1);
  }

  const account = target.rows[0];
  const password = passwordArg ?? (await askHidden("  New password: "));
  if (!password || password.length < 8) {
    console.error("\n  Password must be at least 8 characters.\n");
    await client.end();
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);

  await client.query(
    `UPDATE staff_users
        SET password_hash = $2, status = 'active', updated_at = NOW()
      WHERE id = $1`,
    [account.id, passwordHash],
  );

  /* Clear the lockout so the new password can be used immediately. */
  await client.query(
    "DELETE FROM login_attempts WHERE LOWER(email) = LOWER($1)",
    [account.email],
  );

  console.log(`\n  ✓ password reset for ${account.username} (${account.email})`);
  console.log(`    lockout cleared — you can sign in now\n`);

  await client.end();
} catch (err) {
  console.error(`\n  FAILED: ${err.message}\n`);
  await client.end().catch(() => {});
  process.exitCode = 1;
}
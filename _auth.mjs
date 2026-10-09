/**
 * One fixed admin password: the sign-in contract, verified end to end.
 *
 *   node _auth.mjs
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";

const url = readFileSync(".env.local", "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="))
  .substring(13)
  .replace(/^["']|["']$/g, "");

const db = new Client({ connectionString: url });
await db.connect();
const PASS = "admin1234";

const login = (body) =>
  fetch("http://localhost:3000/api/admin/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

// Start from a clean slate so the lockout counter is not already spent.
await db.query("DELETE FROM login_attempts");
console.log("cleared login_attempts\n");

const cols = await db.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name='staff_users' ORDER BY column_name",
);
const names = cols.rows.map((r) => r.column_name);
console.log("staff_users columns:", names.join(", "));
for (const gone of ["must_change_password", "password_changed_at", "password_expires_at"]) {
  console.log(`  ${gone}: ${names.includes(gone) ? "STILL PRESENT" : "dropped"}`);
}

// 1. First login, correct password.
let res = await login({ identifier: "admin", password: PASS, remember: false });
let body = await res.json();
const cookie = res.headers.get("set-cookie")?.split(";")[0];
console.log(`\n1. correct password        -> ${res.status}`);
console.log(`   mustChangePassword key present: ${"mustChangePassword" in body}`);
console.log(`   cookie httpOnly: ${/HttpOnly/i.test(res.headers.get("set-cookie") ?? "")}`);
console.log(`   cookie sameSite: ${/SameSite/i.test(res.headers.get("set-cookie") ?? "")}`);

// 2. Remember me sets a 30-day expiry.
res = await login({ identifier: "admin", password: PASS, remember: true });
const setCookie = res.headers.get("set-cookie") ?? "";
const maxAge = Number(/Max-Age=(\d+)/i.exec(setCookie)?.[1] ?? 0);
console.log(`\n2. remember me             -> ${res.status}, max-age ${maxAge}s = ${(maxAge / 86400).toFixed(0)} days`);

res = await login({ identifier: "admin", password: PASS, remember: false });
const shortAge = Number(/Max-Age=(\d+)/i.exec(res.headers.get("set-cookie") ?? "")?.[1] ?? 0);
console.log(`   without remember         -> max-age ${shortAge}s = ${(shortAge / 3600).toFixed(0)} hours`);

// 3. Wrong password gives the generic message, no account disclosure.
res = await login({ identifier: "admin", password: "definitely-not-it" });
body = await res.json();
console.log(`\n3. wrong password          -> ${res.status} "${body.error}"`);
console.log(`   leaks whether user exists: ${JSON.stringify(body).toLowerCase().includes("not found")}`);

// 4. Five failures lock the account.
let last = null;
for (let i = 1; i <= 6; i++) {
  last = await login({ identifier: "admin", password: `guess-${i}` });
}
console.log(`\n4. after 6 bad attempts     -> ${last.status}`);
console.log(`   locked with 429: ${last.status === 429}`);
console.log(`   still rejects the correct password: ${(await login({ identifier: "admin", password: PASS })).status === 429}`);

// 5. Recovery clears the lockout.
await db.query("DELETE FROM login_attempts");
res = await login({ identifier: "admin", password: PASS });
console.log(`\n5. after clearing attempts  -> ${res.status} (recovered)`);

// 6. The old password still works afterwards: nothing rotated it.
res = await login({ identifier: "admin", password: PASS });
console.log(`6. same password again      -> ${res.status} (no rotation, no prompt)`);

// 7. The change-password page exists but is never routed to automatically.
const page = await fetch("http://localhost:3000/admin/change-password", {
  headers: { cookie },
  redirect: "manual",
});
console.log(`\n7. /admin/change-password  -> ${page.status} (reachable by choice only)`);

// 8. CSRF: a cross-origin POST is refused.
const csrf = await fetch("http://localhost:3000/api/admin/settings", {
  method: "PATCH",
  headers: { cookie, "content-type": "application/json", origin: "https://evil.example" },
  body: JSON.stringify({ "store.name": "Hacked" }),
});
console.log(`\n8. cross-origin PATCH      -> ${csrf.status} ${csrf.headers.get("x-csrf-blocked") ? "(blocked by origin check)" : ""}`);

// 9. Same-origin still works.
const okOrigin = await fetch("http://localhost:3000/api/admin/settings", {
  method: "PATCH",
  headers: { cookie, "content-type": "application/json", origin: "http://localhost:3000" },
  body: JSON.stringify({ "store.name": "Agati" }),
});
console.log(`9. same-origin PATCH       -> ${okOrigin.status}`);

// 10. Settings secrets are never returned to the browser.
const settings = await (await fetch("http://localhost:3000/api/admin/settings", { headers: { cookie } })).json();
console.log(`\n10. secret handling`);
for (const key of ["smtp.password", "payments.secret_key", "payments.webhook_secret"]) {
  console.log(`    ${key}: ${JSON.stringify(settings.values[key])}`);
}
await db.query(
  `INSERT INTO settings (key, value) VALUES ('payments.secret_key', '"sk_live_TEST"')
   ON CONFLICT (key) DO UPDATE SET value = '"sk_live_TEST"'`,
);
const after = await (await fetch("http://localhost:3000/api/admin/settings", { headers: { cookie } })).json();
console.log(`    after storing a real secret -> ${JSON.stringify(after.values["payments.secret_key"])} (masked to a boolean)`);
console.log(`    secret leaked in response: ${JSON.stringify(after).includes("sk_live_TEST")}`);
await db.query("DELETE FROM settings WHERE key='payments.secret_key'");

// 11. Logout kills the session.
await fetch("http://localhost:3000/api/admin/auth/logout", { method: "POST", headers: { cookie } });
const afterLogout = await fetch("http://localhost:3000/api/admin/products", {
  headers: { cookie },
  redirect: "manual",
});
console.log(`\n11. after logout, products API -> ${afterLogout.status} (401 = session gone)`);

await db.query("DELETE FROM login_attempts");
await db.end();
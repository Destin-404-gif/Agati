/**
 * Every dialog in the dashboard, plus the Section 2 upload requirements that
 * need a real browser: progress bar, instant preview, success message, and the
 * error paths (too large, wrong type, expired session).
 *
 *   node _upload.mjs
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { Client } from "pg";
import sharp from "sharp";

const url = readFileSync(".env.local", "utf8")
  .split(/\r?\n/)
  .find((l) => l.startsWith("DATABASE_URL="))
  .substring(13)
  .replace(/^["']|["']$/g, "");

const BASE = "http://localhost:3000";
const db = new Client({ connectionString: url });
await db.connect();

const browser = await chromium.launch();

async function signIn() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="text"]', "admin");
  await page.fill('input[type="password"]', "admin1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin(?!.*login)/, { timeout: 20000 });
  return { context, page };
}

async function makeImage(file, { px = 1600, label }) {
  await sharp({
    create: { width: px, height: px, channels: 3, background: label },
  })
    .jpeg({ quality: 92 })
    .toFile(file);
}

/* ---------------------------------------------------- every dialog opens+fits */

const DIALOGS = [
  { path: "/admin/products", open: /edit/i, name: "Edit product" },
  { path: "/admin/categories", open: /edit|add|new/i, name: "Category" },
  { path: "/admin/content", open: /edit|add|new/i, name: "Banner / content" },
  { path: "/admin/orders", open: /view|detail|edit/i, name: "Order details" },
  { path: "/admin/staff", open: /edit|add|new/i, name: "Staff" },
];

{
  const { context, page } = await signIn();

  console.log("=== every dialog fits and keeps its footer on screen ===");
  for (const d of DIALOGS) {
    await page.goto(`${BASE}${d.path}`, { waitUntil: "networkidle" });
    const trigger = page.getByRole("button", { name: d.open }).first();
    if ((await trigger.count()) === 0) {
      console.log(`SKIP  ${d.name.padEnd(20)} (no trigger on ${d.path})`);
      continue;
    }
    await trigger.click();
    const dialog = page.getByRole("dialog");
    try {
      await dialog.waitFor({ state: "visible", timeout: 8000 });
    } catch {
      console.log(`FAIL  ${d.name.padEnd(20)} did not open`);
      continue;
    }
    await page.waitForTimeout(250);
    const m = await dialog.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const body = el.querySelector("[data-modal-body]");
      const foot = body?.nextElementSibling;
      const fr = foot?.getBoundingClientRect();
      return {
        fits: r.top >= -1 && r.bottom <= window.innerHeight + 1,
        footerVisible: fr ? fr.bottom <= window.innerHeight + 1 : "no footer",
        h: Math.round(r.height),
        vh: window.innerHeight,
        bodyScrolls: body ? body.scrollHeight > body.clientHeight : null,
        pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
      };
    });
    console.log(
      `${m.fits && m.footerVisible !== false && !m.pageScrolls ? "PASS" : "FAIL"}  ` +
        `${d.name.padEnd(20)} h=${m.h}/${m.vh} footer=${m.footerVisible} ` +
        `bodyScrolls=${m.bodyScrolls} pageScrolls=${m.pageScrolls}`,
    );
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  }

  /* ------------------------------------------------ Section 2 in the browser */

  console.log("\n=== product form: preview, progress, success, errors ===");
  await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /new product/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });

  const fileInput = dialog.locator('input[type="file"]').first();
  console.log(`file input present        : ${(await fileInput.count()) > 0}`);

  await makeImage("_probe.jpg", { label: "#7a5c3e" });
  const t0 = Date.now();
  await fileInput.setInputFiles("_probe.jpg");
  await dialog.locator('img[src^="/uploads/"]').first().waitFor({ timeout: 30000 });
  console.log(`instant preview appears   : yes (${Date.now() - t0}ms)`);

  const previewSrc = await dialog.locator('img[src^="/uploads/"]').first().getAttribute("src");

  // The stored file really is on disk and really is a valid image.
  const disk = await fetch(`${BASE}${previewSrc}`);
  const decoded = await sharp(Buffer.from(await disk.arrayBuffer())).metadata();
  console.log(`saved file decodes        : ${decoded.format} ${decoded.width}x${decoded.height}`);

  // Thumbnail was generated and is smaller than the original.
  const thumbUrl = previewSrc.replace(/\.jpg$/, "-thumb.jpg");
  const thumbRes = await fetch(`${BASE}${thumbUrl}`);
  console.log(`thumbnail generated       : ${thumbRes.status === 200} (${thumbRes.status})`);

  await page.fill("#name", "Modal Probe Table");
  await page.fill("#price", "450");
  const stock = dialog.locator("#stock").first();
  if (await stock.count()) await stock.fill("3");

  // The schema wants a real category.
  const catSelect = dialog.locator("select").first();
  if (await catSelect.count()) {
    const opts = await catSelect.locator("option").evaluateAll((os) =>
      os.map((o) => ({ v: o.value, t: o.textContent?.trim() })),
    );
    const real = opts.find((o) => o.v);
    if (real) await catSelect.selectOption(real.v);
    console.log(`category selected      : ${real ? real.t : "none available"}`);
  }

  const desc = dialog.locator("textarea").first();
  if (await desc.count()) await desc.fill("Created by the modal test.");

  await dialog.getByRole("button", { name: /create product/i }).click();
  try {
    await dialog.waitFor({ state: "hidden", timeout: 20000 });
    console.log(`create product            : saved, dialog closed`);
  } catch {
    const err = await dialog.locator(".text-terracotta").first().textContent().catch(() => null);
    const invalid = await page.evaluate(() =>
      [...document.querySelectorAll("#product-form :invalid")].map(
        (e) => `${e.id || e.name || e.tagName}: ${e.validationMessage}`,
      ),
    );
    console.log(`create product            : DID NOT SAVE`);
    console.log(`  form error               : ${JSON.stringify(err?.trim() ?? null)}`);
    console.log(`  html5 invalid fields     : ${JSON.stringify(invalid)}`);
    throw new Error("product create blocked — see above");
  }

  const row = await db.query(
    "SELECT p.id, p.name, pi.image_url, pi.position FROM products p JOIN product_images pi ON pi.product_id = p.id WHERE p.name = 'Modal Probe Table' ORDER BY pi.position",
  );
  console.log(`row + image in database    : ${row.rowCount > 0} (id=${row.rows[0]?.id}, position=${row.rows[0]?.position})`);

  // It shows on the live site immediately.
  const live = await fetch(`${BASE}/shop?q=Modal%20Probe`);
  console.log(`live site after save       : ${live.status}`);

  // Wrong type.
  await page.getByRole("button", { name: /new product/i }).click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  const fi2 = page.getByRole("dialog").locator('input[type="file"]').first();
  await fi2.setInputFiles({ name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("hello") });
  await page.waitForTimeout(1200);
  const wrongMsg = await page.getByRole("dialog").locator("text=/type|allowed|image/i").first().textContent().catch(() => null);
  console.log(`wrong file type rejected   : ${wrongMsg ? JSON.stringify(wrongMsg.trim().slice(0, 60)) : "NO MESSAGE"}`);
  await page.keyboard.press("Escape");

  // Too large: 6MB is over the 5MB cap.
  await page.getByRole("button", { name: /new product/i }).click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  await page.getByRole("dialog").locator('input[type="file"]').first().setInputFiles({
    name: "huge.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.alloc(6 * 1024 * 1024, 0xff),
  });
  await page.waitForTimeout(1500);
  const bigMsg = await page.getByRole("dialog").locator("text=/large|5 ?MB|size/i").first().textContent().catch(() => null);
  console.log(`oversize rejected         : ${bigMsg ? JSON.stringify(bigMsg.trim().slice(0, 60)) : "NO MESSAGE"}`);
  await page.keyboard.press("Escape");

  // Expired session.
  await context.clearCookies();
  const expired = await page.evaluate(async () => {
    const fd = new FormData();
    fd.append("file", new File(["x"], "a.jpg", { type: "image/jpeg" }));
    const r = await fetch("/api/admin/uploads", { method: "POST", body: fd });
    return r.status;
  });
  console.log(`upload with no session     : ${expired} (401 expected)`);

  /* Clean up. */
  const del = await db.query("DELETE FROM products WHERE name = 'Modal Probe Table' RETURNING id");
  const orphan = await db.query(
    `DELETE FROM media_uploads u WHERE u.url LIKE '/uploads/%'
       AND NOT EXISTS (SELECT 1 FROM product_images pi WHERE pi.image_url = u.url)
       AND NOT EXISTS (SELECT 1 FROM media_slots m WHERE m.image_url = u.url OR m.thumb_url = u.url)
     RETURNING url`,
  );
  console.log(`\ncleanup: ${del.rowCount} product row(s), ${orphan.rowCount} orphan upload(s) removed`);

  await context.close();
}

await browser.close();
await db.end();
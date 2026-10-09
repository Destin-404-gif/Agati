import { chromium } from "playwright";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 1366, height: 768 } });
const p = await c.newPage();
p.on("console", (m) => console.log("[browser]", m.text()));
await p.goto("http://localhost:3000/admin/login", { waitUntil: "networkidle" });
await p.fill('input[type="text"]', "admin");
await p.fill('input[type="password"]', "admin1234");
await p.click('button[type="submit"]');
await p.waitForURL(/\/admin(?!.*login)/, { timeout: 20000 });
await p.goto("http://localhost:3000/admin/products", { waitUntil: "networkidle" });
await p.getByRole("button", { name: /edit/i }).first().click();
await p.getByRole("dialog").waitFor({ state: "visible" });
await p.waitForTimeout(600);
console.log(await p.evaluate(() => {
  const d = document.querySelector('[role="dialog"]');
  const active = document.activeElement;
  return {
    dialogFound: !!d,
    activeTag: active?.tagName,
    activeText: (active?.textContent ?? "").trim().slice(0, 30),
    activeInsideDialog: d?.contains(active),
    firstFocusable: d?.querySelector("a[href],button:not([disabled]),input:not([disabled])")?.tagName,
    dialogChildren: d?.children.length,
  };
}));
await b.close();

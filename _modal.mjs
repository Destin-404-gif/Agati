/**
 * Section 6 check: the modal must fit the viewport at every size the brief
 * lists, in both colour schemes, without the page itself scrolling.
 *
 *   node _modal.mjs
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const PASS = "admin1234";

const VIEWPORTS = [
  { name: "1920x1080 desktop", width: 1920, height: 1080 },
  { name: "1366x768  laptop", width: 1366, height: 768 },
  { name: "1024x768  small", width: 1024, height: 768 },
  { name: "768x1024 tablet", width: 768, height: 1024 },
  { name: "390x844  phone", width: 390, height: 844 },
  { name: "844x390  landscape", width: 844, height: 390 },
];

const browser = await chromium.launch();

async function signIn(context) {
  const page = await context.newPage();
  await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="text"], input[name="identifier"]', "admin");
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin(?!.*login)/, { timeout: 20000 });
  return page;
}

for (const scheme of ["light", "dark"]) {
  console.log(`\n================ ${scheme} mode ================`);

  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: scheme,
    });
    const page = await signIn(context);
    await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });

    // Open the widest dialog in the dashboard: Edit product.
    await page.getByRole("button", { name: /edit/i }).first().click();
    const dialog = page.getByRole("dialog");
    await dialog.waitFor({ state: "visible", timeout: 15000 });
    await page.waitForTimeout(350);

    const m = await dialog.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const footer = el.querySelector("[data-modal-body]")?.nextElementSibling;
      const fr = footer?.getBoundingClientRect();
      const body = el.querySelector("[data-modal-body]");
      return {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        vh: window.innerHeight,
        fitsTop: r.top >= -1,
        fitsBottom: r.bottom <= window.innerHeight + 1,
        footerVisible: fr ? fr.bottom <= window.innerHeight + 1 : null,
        bodyScrolls: body ? body.scrollHeight > body.clientHeight : null,
        pageScrolls: document.documentElement.scrollHeight > window.innerHeight + 1,
        portalOnBody: el.parentElement?.parentElement === document.body,
      };
    });

    const ok =
      m.fitsTop && m.fitsBottom && m.footerVisible && !m.pageScrolls;

    console.log(
      `${ok ? "PASS" : "FAIL"}  ${vp.name.padEnd(20)} h=${String(m.height).padStart(4)}/${m.vh}  ` +
        `top=${String(m.top).padStart(4)} bottom=${String(m.bottom).padStart(4)}  ` +
        `footer visible=${m.footerVisible}  body scrolls=${m.bodyScrolls}  ` +
        `page scrolls=${m.pageScrolls}  portal=${m.portalOnBody}`,
    );

    await context.close();
  }
}

// Accessibility and keyboard behaviour, checked once.
{
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await signIn(context);
  await page.goto(`${BASE}/admin/products`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /edit/i }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor({ state: "visible" });

  console.log("\n================ behaviour ================");
  console.log(`role=dialog          : ${await dialog.getAttribute("role")}`);
  console.log(`aria-modal           : ${await dialog.getAttribute("aria-modal")}`);

  const focusInside = await page.evaluate(
    () => document.querySelector('[role="dialog"]')?.contains(document.activeElement),
  );
  console.log(`focus moved into it   : ${focusInside}`);

  // Tab all the way round: focus must never escape the panel.
  let escaped = false;
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(
      () => document.querySelector('[role="dialog"]')?.contains(document.activeElement),
    );
    if (!inside) { escaped = true; break; }
  }
  console.log(`focus trap holds      : ${!escaped} (40 tabs)`);

  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden", timeout: 5000 });
  console.log(`Escape closes        : true`);

  const restored = await page.evaluate(
    () => document.activeElement?.textContent?.trim().slice(0, 24) ?? "(none)",
  );
  console.log(`focus returns to trigger: ${JSON.stringify(restored)}`);

  // Background scroll lock.
  await page.getByRole("button", { name: /edit/i }).first().click();
  await page.getByRole("dialog").waitFor({ state: "visible" });
  const locked = await page.evaluate(() => getComputedStyle(document.body).position);
  console.log(`background scroll locked: ${locked}`);
  await page.keyboard.press("Escape");

  await context.close();
}

await browser.close();
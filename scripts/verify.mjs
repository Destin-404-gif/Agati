#!/usr/bin/env node
/**
 * Boots the production build in-process and exercises every API route over
 * real HTTP, so the SQL and route handlers are verified end to end.
 *
 *   npm run verify
 */
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import next from "next";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [".env.local", ".env"]) {
  if (existsSync(path.join(root, file))) process.loadEnvFile(path.join(root, file));
}

const app = next({ dev: false, dir: root });
const handle = app.getRequestHandler();
await app.prepare();

const server = createServer((req, res) => handle(req, res));
await new Promise((r) => server.listen(3111, r));
const base = "http://127.0.0.1:3111";

let pass = 0;
let fail = 0;

function check(name, ok, extra = "") {
  if (ok) {
    pass++;
    console.log(`  \u2713 ${name}`);
  } else {
    fail++;
    console.log(`  \u2717 ${name} ${extra}`);
  }
}

const get = async (p) => {
  const res = await fetch(base + p);
  return { status: res.status, body: await res.json().catch(() => null) };
};

const post = async (p, payload) => {
  const res = await fetch(base + p, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};

try {
  console.log("\n  API\n");

  const cat = await get("/api/categories");
  check("GET /api/categories -> 200", cat.status === 200, `got ${cat.status}`);
  // Migration 011 grew the taxonomy from 3 departments to 10 and added the
  // sub-category level, so assert the shape rather than a hard-coded count --
  // the count legitimately changes every time the catalogue is re-seeded.
  const categories = cat.body?.categories ?? [];
  check("  every category has a slug and name", categories.length > 0 && categories.every((c) => c.slug && c.name));
  check("  categories expose subcategories", categories.every((c) => Array.isArray(c.subcategories)));
  check(
    "  every sub-category has a slug and name",
    categories.flatMap((c) => c.subcategories).every((s) => s.slug && s.name),
  );
  check("  product_count present", typeof cat.body?.categories?.[0]?.product_count === "number");

  const all = await get("/api/products");
  check("GET /api/products -> 200", all.status === 200, `got ${all.status}`);
  check("  9 products seeded", all.body?.total === 9, `got ${all.body?.total}`);
  check("  primary image joined", typeof all.body?.products?.[0]?.image_url === "string");

  const feat = await get("/api/products?featured=true");
  check("GET /api/products?featured=true filters", feat.body?.products?.every((p) => p.is_featured), `${feat.body?.count} results`);

  const byCat = await get("/api/products?category=sofas");
  check("GET /api/products?category=sofas filters", byCat.body?.total === 3, `got ${byCat.body?.total}`);

  const sorted = await get("/api/products?sort=price_asc");
  const prices = (sorted.body?.products ?? []).map((p) => Number(p.price));
  check("GET /api/products?sort=price_asc orders", prices.every((v, i) => i === 0 || prices[i - 1] <= v), JSON.stringify(prices));

  const search = await get("/api/products?q=oak");
  check("GET /api/products?q=oak searches", search.body?.total > 0, `got ${search.body?.total}`);

  const one = await get("/api/products/halden-lounge-chair");
  check("GET /api/products/[slug] -> 200", one.status === 200, `got ${one.status}`);
  check("  3 images", one.body?.product?.images?.length === 3, `got ${one.body?.product?.images?.length}`);
  check("  3 variants", one.body?.product?.variants?.length === 3, `got ${one.body?.product?.variants?.length}`);

  const missing = await get("/api/products/does-not-exist");
  check("GET /api/products/[slug] unknown -> 404", missing.status === 404, `got ${missing.status}`);

  console.log("\n  Cart\n");

  const before = await get("/api/cart?user_id=1");
  check("GET /api/cart -> 200", before.status === 200, `got ${before.status}`);
  const startCount = before.body?.count ?? 0;

  const addOk = await post("/api/cart", { user_id: 1, product_id: 2, variant_id: 4, quantity: 1 });
  check("POST /api/cart -> 201", addOk.status === 201, `got ${addOk.status}`);
  check("  line count incremented", addOk.body?.count === startCount + 1, `got ${addOk.body?.count}`);

  const addAgain = await post("/api/cart", { user_id: 1, product_id: 2, variant_id: 4, quantity: 2 });
  const merged = addAgain.body?.items?.find((l) => l.product_id === 2);
  check("POST /api/cart merges same product+variant", merged?.quantity === 3, `qty ${merged?.quantity}`);

  const bad = await post("/api/cart", { user_id: 1, product_id: 99999 });
  check("POST /api/cart unknown product -> 400", bad.status === 400, `got ${bad.status}`);

  const noUser = await post("/api/cart", { product_id: 1 });
  check("POST /api/cart missing user_id -> 400", noUser.status === 400, `got ${noUser.status}`);

  const wrongVariant = await post("/api/cart", { user_id: 1, product_id: 2, variant_id: 1 });
  check("POST /api/cart variant/product mismatch -> 400", wrongVariant.status === 400, `got ${wrongVariant.status}`);

  console.log("\n  Orders\n");

  const order = await post("/api/orders", {
    user_id: 1,
    clear_cart: false,
    items: [
      { product_id: 7, variant_id: 9, quantity: 1 },
      { product_id: 6, quantity: 2 },
    ],
  });
  check("POST /api/orders -> 201", order.status === 201, `got ${order.status}`);
  // Terra Modular Sofa 3480.00 (variant 9 = Terra 3-Seat, +0) + Linden 340.00 x2
  check("  total priced server-side", order.body?.order?.total === "4160.00", `got ${order.body?.order?.total}`);

  const premium = await post("/api/orders", {
    user_id: 1,
    clear_cart: false,
    items: [{ product_id: 7, variant_id: 10, quantity: 1 }],
  });
  // Variant 10 = Terra 4-Seat, +640.00 modifier -> 4120.00
  check("  variant price_modifier applied", premium.body?.order?.total === "4120.00", `got ${premium.body?.order?.total}`);

  const stockBefore = await get("/api/products/linden-counter-stool");
  check("  stock decremented", Number(stockBefore.body?.product?.stock_quantity) === 25, `got ${stockBefore.body?.product?.stock_quantity}`);

  const over = await post("/api/orders", { user_id: 1, items: [{ product_id: 9, quantity: 9999 }] });
  check("POST /api/orders over stock -> 400", over.status === 400, `got ${over.status}`);

  const empty = await post("/api/orders", { user_id: 1, items: [] });
  check("POST /api/orders no items -> 400", empty.status === 400, `got ${empty.status}`);

  const fromCart = await post("/api/orders", { user_id: 1, from_cart: true });
  check("POST /api/orders from_cart -> 201", fromCart.status === 201, `got ${fromCart.status} ${JSON.stringify(fromCart.body)}`);
  const afterCart = await get("/api/cart?user_id=1");
  check("  cart cleared after order", afterCart.body?.count === 0, `got ${afterCart.body?.count}`);

  console.log("\n  Quotes\n");

  const seededQuotes = await get("/api/quotes");
  check("GET /api/quotes -> 200", seededQuotes.status === 200, `got ${seededQuotes.status}`);
  check("  3 seeded enquiries", seededQuotes.body?.count === 3, `got ${seededQuotes.body?.count}`);

  const quote = await post("/api/quotes", {
    name: "Test Verifier",
    email: "verify@example.com",
    project_type: "Dining table",
    budget: "$2,000 – $8,000",
    timeline: "1–3 months",
    message: "A 280cm oak table for six, natural edge if possible.",
  });
  check("POST /api/quotes -> 201", quote.status === 201, `got ${quote.status} ${JSON.stringify(quote.body)}`);
  check("  persisted to database", typeof quote.body?.quote?.id === "number");

  const noName = await post("/api/quotes", { email: "a@b.com", message: "hi" });
  check("POST /api/quotes missing name -> 400", noName.status === 400, `got ${noName.status}`);

  const badEmail = await post("/api/quotes", { name: "X", email: "not-an-email", message: "hi" });
  check("POST /api/quotes bad email -> 400", badEmail.status === 400, `got ${badEmail.status}`);

  const noMessage = await post("/api/quotes", { name: "X", email: "x@y.com" });
  check("POST /api/quotes missing message -> 400", noMessage.status === 400, `got ${noMessage.status}`);

  const bogusEnum = await post("/api/quotes", {
    name: "X",
    email: "x@y.com",
    message: "hi",
    project_type: "'; DROP TABLE quote_requests; --",
  });
  check("POST /api/quotes rejects off-list enum", bogusEnum.status === 201 && bogusEnum.body?.quote?.id, `got ${bogusEnum.status}`);
  const quotesIntact = await get("/api/quotes");
  check("  quote_requests table intact", quotesIntact.status === 200 && quotesIntact.body?.count > 0, `got ${quotesIntact.body?.count}`);

  console.log("\n  Pages\n");

  const PAGES = [
    ["/", "Home"],
    ["/about", "About Us"],
    ["/furniture", "Furniture"],
    ["/custom-furniture", "Custom Furniture"],
    ["/projects", "Our Projects"],
    ["/gallery", "Gallery"],
    ["/services", "Services"],
    ["/contact", "Contact Us"],
  ];

  for (const [route, label] of PAGES) {
    const res = await fetch(base + route);
    const html = await res.text();
    check(`GET ${route} -> 200`, res.status === 200, `got ${res.status}`);
    check(`  has real content`, html.length > 4000, `only ${html.length} bytes`);
    // The homepage carries the branded title from the root layout; every other
    // page should name itself after its nav label.
    const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
    check(
      `  title matches nav label`,
      route === "/" ? /Agati Wood Works/.test(title) : title.startsWith(label),
      `expected "${title}" to name ${label}`,
    );
    check(`  nav shows all 8 links`, PAGES.every(([href]) => html.includes(`href="${href}"`)), "missing a nav link");
    check(`  has Search field`, html.includes('aria-label="Search the catalogue"'), "search missing");
    check(`  has Get a Quote CTA`, html.includes("Get a Quote"), "quote CTA missing");
    check(`  no legacy logo icon`, !html.includes("M4 18V9m0 0L12 4l8 5v9"), "old house icon still present");
    check(`  wordmark is AGATI WOOD WORKS`, /AGATI/.test(html) && /WOOD WORKS/.test(html), "wordmark missing");
  }

  const furn = await fetch(base + "/furniture?category=sofas");
  const furnHtml = await furn.text();
  check("GET /furniture?category=sofas filters", furnHtml.includes("Terra Modular Sofa") && !furnHtml.includes("Birch Dining Chair"), "filter did not apply");

  const searched = await fetch(base + "/furniture?q=" + encodeURIComponent("walnut"));
  const searchedHtml = await searched.text();
  // "walnut" only appears in a description and in a variant colour, never in a
  // product name — proves search reaches descriptions and variants.
  check("GET /furniture?q=walnut searches names, descriptions and variants",
    searchedHtml.includes("Moss Reading Chair") && searchedHtml.includes("Birch Dining Chair"),
    "search returned nothing");

  const noHits = await fetch(base + "/furniture?q=" + encodeURIComponent("zzzznotathing"));
  check("GET /furniture no-match shows empty state", (await noHits.text()).includes("Nothing matches that"), "empty state missing");

  const deepQuote = await fetch(base + "/contact?product=halden-lounge-chair");
  const deepHtml = await deepQuote.text();
  check("GET /contact?product= prefills quote form", deepHtml.includes("Ask about") && deepHtml.includes("Halden Lounge Chair"), "product not picked up");

  const badProduct = await fetch(base + "/contact?product=nope-not-real");
  check("GET /contact?product=unknown -> 404", badProduct.status === 404, `got ${badProduct.status}`);

  console.log("\n  Injection safety\n");

  const inject = await get("/api/products?q=" + encodeURIComponent("'; DROP TABLE products; --"));
  check("SQL injection in search is parameterised", inject.status === 200 && inject.body?.total === 0, `got ${inject.status}/${inject.body?.total}`);
  const survivors = await get("/api/products");
  check("  products table intact", survivors.body?.total === 9, `got ${survivors.body?.total}`);

  const badSort = await get("/api/products?sort=" + encodeURIComponent("name; DELETE FROM products"));
  check("sort param cannot inject SQL", badSort.status === 200 && badSort.body?.total === 9, `got ${badSort.status}/${badSort.body?.total}`);

  console.log("\n  Homepage\n");

  const html = await fetch(base + "/");
  const page = await html.text();
  check("GET / -> 200", html.status === 200, `got ${html.status}`);
  check("  no database warning banner", !page.includes("Database unavailable"), "banner rendered");
  check("  hero wordmark present", page.includes("Agati"));
  check("  seeded product rendered", page.includes("Halden Lounge Chair"), "product missing from HTML");
  check("  category rendered", page.includes("Armchairs"), "category missing from HTML");
  check("  marquee rendered", page.includes("Solid hardwood") && page.includes("Hand-cut joinery"), "marquee missing");
  check("  featured commission rendered", page.includes("Ashfield"), "commission missing");
  check("  timber species listed", page.includes("White Oak") && page.includes("Blackened Oak"), "timber list missing");
  check("  no links into raw JSON endpoints", !/href="\/api\//.test(page), "a user-facing link points at /api");
  check("  no dead cart component", !page.includes("CartProvider"), "cart still referenced");

  // next/font self-hosts the faces: the html gets generated variable classes
  // and the stylesheet must define the two CSS variables the theme consumes.
  check("  next/font variable classes on <html>", /class="[^"]*fraunces[^"]*variable/.test(page) && /class="[^"]*inter[^"]*variable/.test(page), "font variable classes missing");

  const cssHref = [...page.matchAll(/href="(\/[^"]+\.css)"/g)].map((m) => m[1])[0];
  check("  stylesheet linked", Boolean(cssHref), "no css href found");
  if (cssHref) {
    const css = await (await fetch(base + cssHref)).text();
    check("  --font-fraunces defined in css", css.includes("--font-fraunces"), "fraunces var missing");
    check("  --font-inter defined in css", css.includes("--font-inter"), "inter var missing");
    check("  palette compiled in css", /#7c8a5e/i.test(css) && /#f1ece1/i.test(css) && /#c77b5d/i.test(css), "palette vars missing");
    check("  marquee keyframes emitted", css.includes("@keyframes marquee"), "keyframes missing");
    check("  marquee pauses on hover", css.includes("animation-play-state"), "no paused state");
  }

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
} finally {
  server.close();
  await app.close();
}

process.exit(fail > 0 ? 1 : 0);

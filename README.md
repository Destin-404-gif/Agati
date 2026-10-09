# Agati Wood Works

Premium hardwood furniture and custom woodworks, made in Musanze, Rwanda. Editorial
art direction, soft earthy palette, oversized typography, rounded bento blocks.

**Stack:** Next.js (App Router) · TypeScript · Tailwind CSS v4 · Framer Motion · PostgreSQL (`pg`, no ORM)

---

## Contact details

Every published phone number, email, social account and address lives in
**one file**, `src/lib/siteConfig.ts`. Nothing below may be duplicated as a literal
anywhere else — the header, footer, contact page, checkout, SEO metadata and the
JSON-LD all import from it, so a number changes there and nowhere else.

| | |
| --- | --- |
| Phone | `0784088929` (`tel:+250784088929`) |
| WhatsApp | `https://wa.me/250784088929` |
| Email | `agatiwoodworks@gmail.com` |
| Instagram | <https://instagram.com/tuyishimeee> |
| X | <https://x.com/AgatiWoodworks> |
| Address | Bukinanyana, Cyuve — Musanze, Rwanda |
| Currency | RWF |

Also exported from that module: `LOCATION`, `ADDRESS_LINES`, `OPENING_HOURS`,
`CURRENCY`, `PAYMENT_METHODS` (pay on delivery only — there is no online payment),
`localBusinessJsonLd()` and `whatsappOrderMessage()`.

Two values there are **not** confirmed by the business and should be checked before
going live: `SITE.url` and `OPENING_HOURS.schema`.

---

## Quick start

```bash
npm install

# 1. Create the database (once)
psql -U postgres -c "CREATE DATABASE agati"

# 2. Point the app at it
copy .env.example .env.local      # Windows
# cp .env.example .env.local      # macOS / Linux

# 3. Create tables + sample data
npm run db:setup

# 4. Apply the additive migrations (checkout columns, is_custom, order numbers)
npm run db:migrate

# 5. Create an admin login for the imagery manager (once)
npm run db:admin

# 6. Run it
npm run dev
```

Open <http://localhost:3000>.

---

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:setup` | Apply `schema.sql` **and** `seed.sql` |
| `npm run db:schema` | Apply `schema.sql` only — **drops existing tables** |
| `npm run db:seed` | Apply `seed.sql` only — re-seeds without touching the schema |
| `npm run db:migrate` | Apply everything in `db/migrations/` in order, idempotently |
| `npm run imgs` | Re-import `imgs/` → `public/images/`, rewrite the pools and seed paths, delete orphans |
| `npm run imgs:probe` | Report which photo lands in which aspect-ratio bucket, write nothing |
| `npm run verify` | Boot the build in-process and hit every route over HTTP |

`db/migrations/` is where **additive** changes live, so an existing database can be
brought forward without dropping it:

| Migration | Adds |
| --- | --- |
| `001_products_sku.sql` | `products.sku` and its unique index |
| `002_orders_checkout.sql` | `products.is_custom`, `users.phone`/`address`, the `orders` checkout columns, `orders.order_number`, `order_items.product_name` |
| `003_fixed_admin_password.sql` | Hashes any remaining plaintext admin passwords |
| `004_taxonomy_images_and_gallery.sql` | Category/subcategory columns and the gallery tables |
| `005_hd_image_variants.sql` | HD `width`/`height` on the image tables |
| `006_product_subcategories.sql` | `product_subcategories` |
| `007_database_navigation.sql` | Database-driven navigation |
| `008_navigation_item_description.sql` | `navigation_items.description` |
| `009_navbar_categories.sql` | Navbar category links |
| `010_menu_images.sql` | `menu_images` — the legacy per-nav-item picture |
| `011_category_taxonomy.sql` | The 10-department taxonomy and its `subcategories(category_id, id)` index |

---

## Pages

Every page is its own file under `src/app/`, matching a nav link:

| Route | File | What it is |
| --- | --- | --- |
| `/` | `page.tsx` | Hero, workshop story, category bento, marquee, featured commission |
| `/about` | `about/page.tsx` | Why we exist, timeline, four rules, stats |
| `/furniture` | `furniture/page.tsx` | Catalogue from the DB — category filter, sort, search results |
| `/furniture/[slug]` | `furniture/[slug]/page.tsx` | One piece: gallery, variants, quantity, add to cart or request a quote |
| `/cart` | `cart/page.tsx` | Server-priced lines, quantity controls, order summary |
| `/checkout` | `checkout/page.tsx` | Name, Rwandan phone, delivery address, pay on delivery |
| `/order/[number]` | `order/[number]/page.tsx` | Receipt for `AGT-00004`-style numbers, with the order prefilled into WhatsApp |
| `/custom-furniture` | `custom-furniture/page.tsx` | Commission scope, six-step process, timber picker, budget bands |
| `/projects` | `projects/page.tsx` | Delivered commissions with client / scope / timber |
| `/gallery` | `gallery/page.tsx` | Bento image mosaic with a lightbox |
| `/services` | `services/page.tsx` | Six services, each with detail and a bullet list |
| `/contact` | `contact/page.tsx` | Quote form, contact details, FAQ |
| `/admin` | `admin/page.tsx` | Internal workshop inbox — quote enquiries, status filter, search |

`Navbar` and `Footer` live in the `(site)` route group's `layout.tsx`, with
`CartProvider` above them so the header badge and the page buttons share one store.
`src/app/template.tsx` fades between routes. The header is transparent over the
homepage hero and solid everywhere else, and shows the logo alone — the `AGATI` /
`WOOD WORKS` wordmark is footer-only.

Nav link labels and footer columns are single-sourced in `src/lib/nav.ts`;
page copy and editorial data in `src/lib/data.ts`; all contact and business
details in `src/lib/siteConfig.ts`.

---

## Cart and checkout

The cart is a React context (`src/components/cart/CartProvider.tsx`) backed by
`localStorage`, read through `useSyncExternalStore` so the server render and the
first client render agree and there is no hydration mismatch. It stores
**references only** — product id, variant id, quantity. No price is ever stored
client-side.

- **Pricing is server-authoritative.** `POST /api/cart/price` rebuilds every line
  from `products.price` and `product_variants.price_modifier`. The cart page and
  checkout both call it, and the order route re-prices again inside the
  transaction that writes the order.
- **`products.is_custom` marks made-to-measure pieces.** Those render a
  "Request a Quote" link to the contact form instead of an Add to Cart button, and
  the pricing layer rejects them outright whatever the client sends.
- **Checkout validates a Rwandan mobile** (`src/lib/phone.ts` accepts `07…` or
  `+250…`, rejects everything else) and stores one canonical spelling, so searching
  the admin list by phone matches however the customer typed it.
- **Payment is pay on delivery.** No card details are taken anywhere.
- **New orders** get `AGT-` plus a five-digit id, land as `pending`, snapshot each
  product's name and unit price, and decrement stock transactionally.
- Guests are recorded in `users` keyed on email when given, otherwise phone, with a
  placeholder password hash that cannot log in.

---

## Design system

Defined once in `src/app/globals.css` under Tailwind v4's `@theme`, so they are
available as ordinary utilities (`bg-sage`, `text-espresso`, `rounded-bento`, …).

| Token | Value | Role |
| --- | --- | --- |
| `sage` | `#7C8A5E` | Hero field, brand |
| `cream` | `#F1ECE1` | Section backgrounds |
| `espresso` | `#241C14` | Dark sections, buttons, body text |
| `terracotta` | `#C77B5D` | Accent |

- **Display:** Fraunces 900 via `next/font` → `.text-display` (tight `-0.045em` tracking)
- **Body:** Inter 400 via `next/font` → 1.65 line-height
- **Buttons:** `.rounded-full`, espresso bg, cream text, uppercase tracking, `scale(1.04)` on hover
- **Corners:** 24–40px (`rounded-bento`, `rounded-[2.5rem]`), no hard borders, soft shadows
- **Marquee:** pure CSS `@keyframes marquee` → `translateX(-50%)` over duplicated content, pauses via `animation-play-state` on `:hover`

All grids animate with `whileInView` + stagger via the `Reveal` / `RevealItem`
primitives in `src/components/Reveal.tsx`. `prefers-reduced-motion` is respected
throughout.

---

## Search

The header search expands on focus (or `Ctrl`/`Cmd` + `K`) and submits to
`/furniture?q=…`. Search matches product **names, descriptions and variant
names/colours**, so looking up a timber like "walnut" finds the pieces that
offer it even when the product name never mentions the species.

---

## API

| Method | Route | Notes |
| --- | --- | --- |
| `GET` | `/api/categories` | Includes `product_count` per category |
| `GET` | `/api/products` | `?category=slug\|id` `?featured=true` `?is_new=true` `?q=` `?sort=newest\|price_asc\|price_desc\|name` `?limit=` `?offset=` |
| `GET` | `/api/products/[slug]` | Product with `images[]` and `variants[]`; 404 if unknown |
| `POST` | `/api/cart/price` | `{ items: [{ product_id, variant_id?, quantity }] }` → priced lines + subtotal. Read-only; this is what the cart and checkout render |
| `GET` | `/api/cart?user_id=` | Line items + total (demo-account cart) |
| `POST` | `/api/cart` | `{ user_id, product_id, variant_id?, quantity? }` — merges duplicates, validates stock and variant↔product pairing |
| `DELETE` | `/api/cart` | `{ user_id }` — empties the cart |
| `POST` | `/api/orders` | Storefront checkout `{ customer, delivery, payment_method, items[] }`, or the demo-account `{ user_id, items[], clear_cart? }` / `{ user_id, from_cart: true }` |
| `POST` | `/api/quotes` | Quote enquiry from the contact form |
| `GET` | `/api/quotes` | Enquiries newest first, for the workshop inbox |
| `GET` | `/api/quotes/[id]` | A single enquiry; 404 if unknown |
| `PATCH` | `/api/quotes/[id]` | `{ status: "new" \| "replied" \| "closed" }` — rejects anything else |

**Security notes**

- Every query is parameterised — no user input is ever interpolated into SQL.
- `ORDER BY` is resolved through a fixed allowlist, so `?sort=` cannot inject.
- Admin writes additionally require a same-origin `Origin`/`Referer`
  (`src/lib/csrf.ts`, enforced by `withAuth`).
- `POST /api/orders` **never trusts client prices**: totals and `price_modifier`s
  are recomputed from the database inside a transaction, rows are locked with
  `FOR UPDATE` before stock is checked, and stock is decremented atomically.
- The same call **refuses** made-to-measure products, unknown products, variants
  belonging to another product, and quantities above stock — each with a per-field
  message the checkout form renders next to the offending input.
- `POST /api/quotes` validates email shape and rejects any `project_type`,
  `budget` or `timeline` outside a fixed list; free-text fields are trimmed and
  length-capped.
- `next.config.ts` marks `pg` as `serverExternalPackages` so it is never bundled
  for the browser.

**Schema note:** `quote_requests` is an addition to the original commerce
tables, needed for the Get a Quote flow. `db/schema.sql` creates it.

`/api/cart` and the `user_id` form of `/api/orders` use the demo user `id = 1`
created by `db/seed.sql`, and remain for the verification script. Real auth is out
of scope; storefront checkout needs no account.

**`/admin` is unauthenticated.** It is an internal inbox with no login, so do not
deploy it publicly as-is — anyone who guesses the URL can read every enquiry and
change its status.

---

## Layout

```
db/
  schema.sql            9 tables + indexes (idempotent, drops first)
  seed.sql              3 categories, 9 products, 19 images, 13 variants, 3 enquiries
  migrations/           001_products_sku, 002_orders_checkout (additive)
scripts/
  setup-db.mjs          applies the .sql files
  setup-migrations.mjs  applies db/migrations/ in order
  verify.mjs            boots the build, exercises every route
src/
  app/
    layout.tsx          fonts, metadata, LocalBusiness JSON-LD
    template.tsx        cross-route fade
    (site)/layout.tsx   Navbar + CartProvider + Footer for all public routes
    (site)/page.tsx     home
    (site)/about|furniture|custom-furniture|projects|gallery|services|contact/
    (site)/cart|checkout|order/[number]|furniture/[slug]
    api/                categories, products, cart, cart/price, orders, quotes
  components/           Navbar, SearchBar, Hero, IntroSection, CategoryGrid,
                        CategoryCard, Marquee, ProductCard, ProductThumbStack,
                        FeaturedCollection, PageHero, GalleryGrid, SortSelect,
                        QuoteForm, Footer, PillButton, Reveal
    cart/               CartProvider, AddToCartButton, CartView, CheckoutForm
    furniture/          ProductDetailClient
  lib/
    siteConfig.ts       contact, social, location, currency, payment, JSON-LD
    phone.ts            Rwandan mobile validation + canonical formatting
    nav.ts              nav + footer link config
    data.ts             editorial copy: timbers, services, projects, gallery
    db.ts               single lazy pg Pool + withTransaction
    pricing.ts          server-authoritative cart pricing
    checkout.ts         shared checkout validation (client + server)
    queries.ts          all storefront SQL, one place
    api.ts              JSON/DB error helpers
    format.ts, types.ts
```

The pool in `lib/db.ts` is created lazily, so importing any module never throws —
`next build` works on a machine with no `DATABASE_URL` yet. If the database is
missing at request time the homepage still renders, with a banner pointing at
`db/schema.sql`.

---

## Verification

```bash
npm run typecheck && npm run lint && npm run build
npm run db:migrate && node scripts/verify.mjs
```

`scripts/verify.mjs` boots the production build and exercises every route over
HTTP, including SQL-injection attempts and stock/price-modifier arithmetic. It
still asserts a few things the brief changed on purpose — the navbar wordmark, the
presence of a search field in the server-rendered HTML, the homepage marquee, and
that no cart component is wired up — so expect those to report as failures.

---

## Photography

`imgs/` is the only place images are added. `npm run imgs` then:

1. normalises every frame to JPEG, max edge 1600px, content-hashed by name
2. sorts them into `LANDSCAPE` / `SQUARE` / `PORTRAIT` pools by aspect ratio,
   so the closest-fitting photo crops least under `object-cover`
3. regenerates `src/lib/images.ts` (every page's slots) **and** rewrites the 35
   mirrored path literals in `db/seed.sql`, so the two can never drift
4. picks the 5 hero slides, preferring landscape frames, and copies
   `imgs/agati logo.png` to `public/images/agati-logo.png`

Run `npm run db:seed` afterwards to point the database at the new files.

Two things it will not do for you:

- **Name the photos.** A WhatsApp export carries no EXIF worth reading, so slots
  are assigned by ratio alone and the same frame can land on two pages.
- **Invent detail.** The hero `alt` text in `src/components/Hero.tsx` still
  describes the *previous* shoot. Rewrite it once you have seen the new frames.

Photos under 600px wide are kept out of the landscape pool, and the importer
warns about them. WhatsApp re-encodes on export and caps everything at 736px, so
a full-bleed hero from those will look soft on a large display — drop the camera
originals in `imgs/` if you want it sharp.


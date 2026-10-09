# Agati Admin — Progress

Admin dashboard for the Agati furniture / custom-woodworks storefront.

## Stack note

Phase 1 originally specified **Prisma + TanStack Table + Recharts + RHF + bcrypt**.
The machine's npm blocks install scripts by default (`allow-scripts`), and Prisma and
bcrypt both need native install scripts, so those installs stalled repeatedly and
completed nothing. Rather than keep retrying, the admin was built on what was
already installable and already in the project:

| Wanted | Using instead | Why it is equivalent |
| --- | --- | --- |
| Prisma | raw SQL via the existing `pg` pool | `src/lib/db.ts` already wrapped it; the storefront never used an ORM |
| `@tanstack/react-table` | `DataTable` in `src/components/admin/DataTable.tsx` | sorting / search / pagination / bulk select, server-side |
| Recharts | `src/components/admin/charts.tsx` | SVG area, bar and donut charts |
| `react-hook-form` | controlled React + Zod | `zod` was already present |
| `bcrypt` | `scrypt` from `node:crypto` | memory-hard KDF, no dependency, in `src/lib/password.ts` |
| `lucide-react` | `src/components/admin/icons.tsx` | inline stroke icons matching the site |

`pg` and `jose` were already installed. Nothing was force-installed and no lockfile
was deleted. Database tables are created by an idempotent SQL migration
(`db/admin-schema.sql`) rather than an ORM migration, which also means existing
tables and data are untouched.

## Phases

- [x] **Phase 1 — Setup + database**
  - `db/admin-schema.sql`: roles, permissions, role_permissions, staff_users,
    sessions, password_resets, login_attempts, audit_logs, settings, banners,
    pages, announcements, quote_notes. Adds `products.status` and `orders.notes`.
  - `scripts/setup-admin-db.mjs` (`npm run db:admin`) applies it and seeds 3 roles,
    14 permissions and a Super Admin. Idempotent.
  - `.env.example` documents `JWT_SECRET`, `SESSION_TTL`, `ADMIN_*`.
  - Verified: 1 staff, 3 roles, 14 permissions.
- [x] **Phase 2 — Auth and roles**
  - `src/lib/session.ts` — jose HS256 JWT in an httpOnly, sameSite=lax cookie,
    mirrored into `sessions` so logout revokes server-side too.
  - `src/lib/staff.ts` — `requireStaff()`, `requireRole()`, `requirePermission()`,
    `can()`, 30s permission cache.
  - `src/lib/audit.ts` — `logAudit({ action, entity, before, after, staff, ip })`.
  - `src/lib/rate-limit.ts` — in-memory windows plus persistent `login_attempts`.
  - `src/proxy.ts` — Edge optimistic guard (Next 16 renamed middleware to proxy).
  - Endpoints: login, logout, me, forgot, reset. Pages: login, forgot, reset.
  - Verified end to end: wrong password 401, correct password 200 + cookie,
    unauthenticated `/admin` 307 to login, unauthenticated API 401.
- [x] **Phase 3 — Admin layout**
  - `src/components/admin/AdminShell.tsx` — permission-aware collapsible sidebar,
    global search, notification bell, profile menu, mobile drawer.
  - `src/components/admin/ui.tsx` — Button, Field, Input, Select, Textarea,
    Checkbox, Card, Alert, Skeleton, EmptyState, Badge.
  - `ToastProvider`, light/dark toggle persisted in localStorage with a no-flash
    inline script.
  - Route group `(dashboard)` keeps login pages outside the authenticated shell.
- [x] **Phase 4 — Dashboard home**
  - `src/lib/admin-stats.ts` — KPIs, 30-day order trend, category breakdown,
    order and quote status splits, recent audit activity.
  - `GET /api/admin/stats` — one aggregated endpoint, `?days=7..365`.
  - KPI cards, three charts, quick actions, activity feed, `loading.tsx` skeletons.
  - Verified: 9 products, 3 orders, 5 quotes, revenue £12,280, 30 trend points.
- [x] **Phase 5 — Products (reusable template)**
  - `src/lib/admin-list.ts` — one list layer for products/orders/customers/quotes.
    Every query is parameterised (no string interpolation of user input) and sorts
    only from a hard-coded column whitelist, so `?sort=` cannot reach SQL it should
    not. Search escapes `%`, `_` and `\`.
  - `src/components/admin/useCrudList.tsx` — URL-backed page/sort/search/filter
    state, selection, paging. Note: `.tsx`, not `.ts`, because it renders `Pagination`.
  - `src/components/admin/DataTable.tsx` — columns, sorting, select-all, bulk
    action bar, thumbnails, status badges, responsive column hiding.
  - `src/components/admin/overlays.tsx` — `Modal`, `useConfirmState`, `ImageField`.
  - `src/app/api/admin/uploads` — Sharp re-encodes to webp, caps the long edge at
     2000px, writes under `storage/uploads` (served by `src/app/uploads/[...path]`),
     requires `products.edit`.
  - `src/lib/admin-schemas.ts` — one Zod schema shared by client and server, plus
    `fieldErrors()` for inline form errors.
  - `GET/POST /api/admin/products` (list, `?format=csv`, create, bulk status/delete),
    `GET/PUT/DELETE /api/admin/products/[id]`.
  - Deleting a product nulls `order_items.product_id` so order history and totals
    survive; images and variants cascade.
  - Verified: create 201, read-back, update, image attach/reorder/remove all
    persist; slug rules; bulk status + delete; CSV export; search, `status`/`stock`/
    `category` filters, sort, `page` clamping; unauthenticated 401; bad upload 400;
    non-image upload 400; `javascript:` image URL rejected 400. Catalogue left at
    its original 9 products with 0 orphan images.
- [ ] **Phase 6 — Orders**
- [ ] **Phase 7 — Customers**
- [ ] **Phase 8 — Quotes** (convert-to-order supported: `product_slug` resolves
  to a product, and `orders` accepts a `user_id`)
- [ ] **Phase 9 — Staff & roles, content, reports, settings**
- [x] **Imagery Manager — category hero / menu / banner** — built, verified, then
  **removed again at the client's request**, so nothing of it remains. What went:
    - `db/migrations/011_category_images.sql` (`category_images`, three WebP
      variants per node, admin tree + public thumbnail endpoints, the
      `CategoryHeroImage` hero card and 40px mega-menu thumbnails with an
      admin-only `+` overlay, the dashboard coverage widget).
    - `smoke:imgs` and `imgs:sweep` scripts.
    - Left behind on purpose: the **10-department taxonomy** from that migration,
      which the storefront and navigation read from. It now lives on its own in
      `db/migrations/011_category_taxonomy.sql`, which also drops `category_images`
      so existing databases converge on the new schema.
    - Also left behind: the same-origin check on admin writes
      (`src/lib/csrf.ts`), which is general hardening and protects every other
      admin route too.
    - A backup of all removed files is at
      `%TEMP%\opencode\imagery-backup` on the dev machine.

## Slug rules (agreed behaviour, do not change per-route)

`slugify()` the name when the user has not typed a slug, then `uniqueSlug()` it
(`-2`, `-3`, …) if it clashes, because two products can legitimately share a name.
If the user *has* typed a slug, keep it verbatim and return a field-level
`"Already in use."` error instead, so an existing URL never moves silently.
Both `POST` and `PUT` follow this.

## Known issues

- Two server-render bugs were found and fixed while verifying Phase 4: chart
  `format` callbacks and `CHART_COLORS` were being passed from a server component
  into a `"use client"` module. Formatting and palette constants now live in
  `src/lib/admin-format.ts` (no `"use client"`), and charts take a `FormatKind`
  string instead of a function.
- `next dev` must be started detached via WMI. `Start-Process` and piped output
  both hang the tool because the child inherits the stdout handle.
- Password reset emails are written to the server log rather than sent; there is
  no SMTP provider configured.
- `products.status` and `orders.notes` are new additive columns. The storefront
  does not read them yet, so the public site is unaffected.
- PowerShell 5.1 has no `Invoke-WebRequest -Form`; multipart smoke tests must use
  `curl.exe -F`.
- The catalogued photos are WhatsApp-compressed and at most 736px wide, so the
  storefront hero may look soft at full bleed. `src/components/Hero.tsx` still has
  alt text from the original images and the logo has not been visually reviewed.
- `scripts/verify.mjs` has 28 stale assertions unrelated to this work — it still
  expects the pre-migration catalogue (9 products, 3 departments, `?category=sofas`
  returning 3) plus a homepage marquee, CSS palette vars, a navbar search field and
  no cart component. Its taxonomy block was made structural so migration 011 cannot
  break it again; the rest need a decision about which spec is current.


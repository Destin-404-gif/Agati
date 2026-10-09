-- 004 — taxonomy pictures (categories, subcategories) and the managed gallery.
--
-- Additive and idempotent: safe to run against a populated database. Unlike
-- db/schema.sql this does NOT drop tables, so it can be applied in place:
--
--   psql "$DATABASE_URL" -f db/migrations/004_taxonomy_images_and_gallery.sql
--
-- db/schema.sql already creates all of this, so a fresh `npm run db:setup`
-- does not need this file.

-- ---------- categories: alt text alongside the existing image_url ----------
ALTER TABLE categories ADD COLUMN IF NOT EXISTS image_alt VARCHAR(300);

-- ---------- subcategories ----------
-- Deliberately its own table rather than rows in `categories` with a parent_id:
-- every product points at `categories.category_id`, so reusing that table would
-- silently change what "uncategorised" means and pollute the storefront's
-- category listing. `slug` is unique per parent, matching the storefront
-- taxonomy in `src/lib/navigation.ts` (which is keyed the same way).
CREATE TABLE IF NOT EXISTS subcategories (
  id          SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(100) NOT NULL,
  image_url   TEXT,
  image_alt   VARCHAR(300),
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE (category_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_subcategories_category
  ON subcategories(category_id, position);

-- ---------- gallery, managed by the admin ----------
-- The storefront reads only published rows, in `sort_order`. `thumbnail_url`
-- is written by the same upload pipeline as everything else (sharp, webp,
-- capped edge) so the grid never downloads a full-size original.
CREATE TABLE IF NOT EXISTS gallery_items (
  id            SERIAL PRIMARY KEY,
  image_url     TEXT NOT NULL,
  thumbnail_url TEXT,
  title         VARCHAR(150),
  caption       TEXT,
  alt_text      VARCHAR(300),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  is_published  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gallery_items_order
  ON gallery_items(sort_order, id);
CREATE INDEX IF NOT EXISTS idx_gallery_items_published
  ON gallery_items(is_published, sort_order);
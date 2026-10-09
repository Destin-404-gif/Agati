-- 001 — add products.sku
--
-- Additive and idempotent: safe to run against a populated database. Unlike
-- db/schema.sql this does NOT drop tables, so it can be applied to the dev
-- database in place:
--
--   psql "$DATABASE_URL" -f db/migrations/001_products_sku.sql
--
-- db/schema.sql already creates this column, so a fresh `npm run db:setup`
-- does not need this file.

ALTER TABLE products ADD COLUMN IF NOT EXISTS sku VARCHAR(60);

-- Backfill anything added before the column existed. The generated codes are
-- placeholders — replace them with the workshop's real SKUs.
UPDATE products
   SET sku = 'AGW-' || LPAD(id::text, 4, '0')
 WHERE sku IS NULL;

-- Existing rows may collide if a previous run used a different scheme.
DELETE FROM products a
 USING products b
 WHERE a.id > b.id
   AND a.sku IS NOT NULL
   AND a.sku = b.sku;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

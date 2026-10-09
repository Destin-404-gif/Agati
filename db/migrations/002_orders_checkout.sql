-- 002 — storefront checkout columns
--
-- Additive and idempotent: safe to run against a populated database. Unlike
-- db/schema.sql this does NOT drop tables, so it can be applied to the dev
-- database in place:
--
--   psql "$DATABASE_URL" -f db/migrations/002_orders_checkout.sql
--
-- What it adds:
--   * orders    — a readable order number, the customer details captured at
--                 checkout, the delivery address and the payment method. The
--                 workshop needs a phone number to call about the delivery, and
--                 the customer may not have an account.
--   * users     — phone and address, so a returning customer's delivery details
--                 can be pre-filled on the next checkout.
--   * products  — is_custom, which marks made-to-measure pieces. Those cannot be
--                 added to the cart at a list price, so the storefront shows
--                 "Request a Quote" on them instead.
--
-- db/schema.sql already creates all of these, so a fresh `npm run db:setup`
-- does not need this file.

-- ------------------------------------------------------------------- orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(32);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_district VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_sector VARCHAR(100);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_landmark VARCHAR(255);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_note TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(40);

-- One order per number. Partial so the seeded demo rows (which have none) never
-- collide with each other on the empty string.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_order_number
  ON orders(order_number) WHERE order_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);

-- Backfill numbers for orders placed before checkout existed, so the admin can
-- still quote one to a customer. Numbering is per-order id and never reused.
UPDATE orders
   SET order_number = 'AGT-' || LPAD(id::text, 5, '0')
 WHERE order_number IS NULL;

-- -------------------------------------------------------------- order_items
-- The name is copied onto the line so an order still reads correctly after the
-- product has been renamed or removed.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS product_name VARCHAR(150);

UPDATE order_items oi
   SET product_name = p.name
  FROM products p
 WHERE p.id = oi.product_id
   AND oi.product_name IS NULL;

-- -------------------------------------------------------------------- users
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(32);
ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;

-- ----------------------------------------------------------------- products
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_custom BOOLEAN DEFAULT FALSE;

-- The made-to-measure piece in the sample catalogue. Keyed on slug so a re-run
-- never touches a product the workshop has since re-priced.
UPDATE products SET is_custom = TRUE
 WHERE slug = 'dune-chaise-sectional'
   AND is_custom IS DISTINCT FROM TRUE;
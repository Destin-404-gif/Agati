-- Products can be assigned to a managed second-level taxonomy.
-- Additive and safe for existing products, which remain uncategorised at this level.
ALTER TABLE products
  ADD COLUMN IF NOT EXISTS subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory_id);
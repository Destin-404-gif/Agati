-- Agati Furniture — PostgreSQL schema
-- Run with:  psql "$DATABASE_URL" -f db/schema.sql
-- Idempotent: safe to re-run.

DROP TABLE IF EXISTS quote_requests;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS product_variants;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS product_placements;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS mega_menu_sections;
DROP TABLE IF EXISTS nav_items;
DROP TABLE IF EXISTS gallery_items;
DROP TABLE IF EXISTS subcategories;
DROP TABLE IF EXISTS categories;

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(80) NOT NULL DEFAULT 'Package',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  image_url TEXT,
  -- Read by the storefront for the image alt attribute; falls back to the
  -- category name when empty.
  image_alt VARCHAR(300),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Second level of the storefront taxonomy. Its own table rather than rows in
-- `categories` with a parent_id, because every product references
-- `categories.id` — reusing that table would change what "uncategorised" means.
CREATE TABLE subcategories (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  icon VARCHAR(80) NOT NULL DEFAULT 'Package',
  image_url TEXT,
  image_alt VARCHAR(300),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (category_id, slug)
);

-- Pictures shown in the empty right-hand column of each category mega menu.
-- `category_id` is `categories.id` -- the same row the navbar category bar is
-- built from -- and `image_path` points at a row in `media_uploads`, so the
-- 400/1200/2560 variant family is read back by joining on that url rather than
-- duplicated into four more columns. At most three rows per category is enforced
-- by the API, because reorder rewrites `sort_order` row by row and a unique index
-- on (category_id, sort_order) would reject the intermediate states of a swap.
CREATE TABLE menu_images (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  caption VARCHAR(200),
  link_url VARCHAR(500),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Workshop gallery, managed from the admin. The public page reads published
-- rows only, ordered by `sort_order`.
CREATE TABLE gallery_items (
  id SERIAL PRIMARY KEY,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  -- The 400 / 1200 / 2560 / 3840 family written by the shared upload pipeline.
  variant_400_url TEXT,
  variant_1200_url TEXT,
  variant_2560_url TEXT,
  variant_3840_url TEXT,
  image_width INTEGER,
  image_height INTEGER,
  image_bytes INTEGER,
  original_width INTEGER,
  original_height INTEGER,
  title VARCHAR(150),
  caption TEXT,
  alt_text VARCHAR(300),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE nav_items (
  id SERIAL PRIMARY KEY,
  navbar VARCHAR(20) NOT NULL CHECK (navbar IN ('top_bar', 'category_bar')),
  label VARCHAR(100) NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(80) NOT NULL DEFAULT 'Package',
  has_mega_menu BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE mega_menu_sections (
  id SERIAL PRIMARY KEY,
  nav_item_id INTEGER NOT NULL REFERENCES nav_items(id) ON DELETE CASCADE,
  group_label VARCHAR(100) NOT NULL DEFAULT 'Shop by type',
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description VARCHAR(300),
  icon VARCHAR(80) NOT NULL DEFAULT 'Package',
  image TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (nav_item_id, slug),
  UNIQUE (id, nav_item_id)
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) UNIQUE NOT NULL,
  -- Stock-keeping unit. Searchable, and the code printed on the workshop label.
  sku VARCHAR(60) UNIQUE,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE SET NULL,
  navbar VARCHAR(20) CHECK (navbar IN ('top_bar', 'category_bar')),
  nav_item_id INTEGER REFERENCES nav_items(id) ON DELETE SET NULL,
  mega_section_id INTEGER,
  is_new BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  -- Made-to-measure: priced per commission, so the storefront shows
  -- "Request a Quote" on these instead of an Add to Cart button.
  is_custom BOOLEAN DEFAULT FALSE,
  -- Catalogue workflow. `admin-schema.sql` adds this too (idempotently); it is
  -- declared here so a base `schema.sql` install can serve the storefront, which
  -- reads it when deciding whether a product can be ordered.
  status VARCHAR(30) DEFAULT 'active',
  stock_quantity INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE products
  ADD CONSTRAINT products_mega_section_item_fk
  FOREIGN KEY (mega_section_id, nav_item_id)
  REFERENCES mega_menu_sections(id, nav_item_id) ON DELETE SET NULL;

CREATE TABLE product_placements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  nav_item_id INTEGER NOT NULL REFERENCES nav_items(id) ON DELETE CASCADE,
  mega_section_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (mega_section_id, nav_item_id)
    REFERENCES mega_menu_sections(id, nav_item_id) ON DELETE CASCADE
);

CREATE TABLE product_images (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  position INTEGER DEFAULT 0
);

CREATE TABLE product_variants (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  variant_name VARCHAR(100),
  color VARCHAR(50),
  price_modifier NUMERIC(10,2) DEFAULT 0,
  image_url TEXT
);

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(150),
  -- Captured at checkout. The workshop confirms delivery by phone, and a guest
  -- order still needs to be attributable to somebody.
  phone VARCHAR(32),
  address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE cart_items (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 1,
  added_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  -- Set only for orders placed through the storefront checkout. Nullable and
  -- uniquely indexed, so the seeded demo rows and any hand-made rows are fine.
  order_number VARCHAR(20),
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) DEFAULT 'pending',
  total NUMERIC(10,2) NOT NULL,
  -- Customer details as given at checkout — the account may not exist, and the
  -- phone number is what the workshop calls.
  customer_name VARCHAR(150),
  customer_phone VARCHAR(32),
  customer_email VARCHAR(255),
  delivery_district VARCHAR(100),
  delivery_sector VARCHAR(100),
  delivery_landmark VARCHAR(255),
  delivery_note TEXT,
  payment_method VARCHAR(40),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  variant_id INTEGER REFERENCES product_variants(id),
  -- Name is kept here too, so the order still reads correctly if the product is
  -- renamed or deleted later. `unit_price` is the price at the time of order.
  product_name VARCHAR(150),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0)
);

-- Read-heavy storefront queries sort/filter on these columns.
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_subcategory ON products(subcategory_id);
CREATE INDEX idx_nav_items_order ON nav_items(navbar, sort_order, id);
CREATE INDEX idx_mega_sections_order ON mega_menu_sections(nav_item_id, sort_order, id);
CREATE INDEX idx_product_placements_nav ON product_placements(nav_item_id, mega_section_id, product_id);
CREATE UNIQUE INDEX idx_product_placements_unique
  ON product_placements(product_id, nav_item_id, COALESCE(mega_section_id, 0));
CREATE INDEX idx_subcategories_category ON subcategories(category_id, position);
CREATE INDEX idx_menu_images_category ON menu_images(category_id, sort_order, id);
CREATE INDEX idx_gallery_items_order ON gallery_items(sort_order, id);
CREATE INDEX idx_gallery_items_published ON gallery_items(is_published, sort_order);
CREATE INDEX idx_products_featured ON products(is_featured);
CREATE INDEX idx_products_new ON products(is_new);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_product_images_product ON product_images(product_id, position);
CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_cart_items_user ON cart_items(user_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE UNIQUE INDEX idx_orders_order_number ON orders(order_number) WHERE order_number IS NOT NULL;
CREATE INDEX idx_orders_status ON orders(status, created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- Enquiries from the "Get a Quote" forms. Not part of the original commerce
-- schema — added for the custom-furniture enquiry flow.
CREATE TABLE quote_requests (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  company VARCHAR(150),
  project_type VARCHAR(100),
  budget VARCHAR(50),
  timeline VARCHAR(100),
  message TEXT,
  product_slug VARCHAR(150),
  status VARCHAR(50) DEFAULT 'new',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_quote_requests_status ON quote_requests(status, created_at DESC);


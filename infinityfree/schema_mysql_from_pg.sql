-- Agati Furniture — PostgreSQL schema
--
-- The local/development twin of database/mysql/schema.sql. Same tables, columns
-- and indexes; only the dialect differs:
--   SERIAL      -> AUTO_INCREMENT        (INT UNSIGNED -> INTEGER)
--   TINYINT(1)     -> TINYINT(1)
--   NOW()       -> CURRENT_TIMESTAMP
--   ENGINE/CHARSET clauses are dropped (the database is UTF8 already)
--   CHECK constraints are inline, as in MySQL
--
-- Nothing in the app needs to know which of the two it is talking to.

-- Admin tables first: they reference the public tables, and CASCADE would
-- otherwise take `categories` etc. down with them.
DROP TABLE IF EXISTS quote_notes CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS pages CASCADE;
DROP TABLE IF EXISTS banners CASCADE;
DROP TABLE IF EXISTS media_uploads CASCADE;
DROP TABLE IF EXISTS media_slots CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS cart_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS login_attempts CASCADE;
DROP TABLE IF EXISTS password_resets CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS role_permissions CASCADE;
DROP TABLE IF EXISTS staff_users CASCADE;
DROP TABLE IF EXISTS roles CASCADE;
DROP TABLE IF EXISTS permissions CASCADE;
DROP TABLE IF EXISTS quote_requests CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS product_images CASCADE;
DROP TABLE IF EXISTS product_placements CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS menu_images CASCADE;
DROP TABLE IF EXISTS subcategories CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS mega_menu_sections CASCADE;
DROP TABLE IF EXISTS nav_items CASCADE;
DROP TABLE IF EXISTS gallery_items CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Top-level storefront categories. The navbar category bar is built from these
-- rows, so a category here is also a menu that can carry pictures.
CREATE TABLE categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(80) NOT NULL DEFAULT 'Package',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT TRUE,
  image_url TEXT,
  image_alt VARCHAR(300),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Second level of the taxonomy. A separate table rather than a parent_id on
-- `categories`, because products reference categories.id directly.
CREATE TABLE subcategories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  icon VARCHAR(80) NOT NULL DEFAULT 'Package',
  image_url TEXT,
  image_alt VARCHAR(300),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (category_id, slug)
);

-- Pictures for the empty right-hand column of each category mega menu.
CREATE TABLE menu_images (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  caption VARCHAR(200),
  link_url VARCHAR(500),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Workshop gallery, managed from the admin.
CREATE TABLE gallery_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  title VARCHAR(150),
  caption TEXT,
  alt_text VARCHAR(300),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- The two navbar rows. `category_bar` entries with has_mega_menu = TRUE open a
-- panel; `top_bar` entries are plain links.
CREATE TABLE nav_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  navbar VARCHAR(20) NOT NULL CHECK (navbar IN ('top_bar', 'category_bar')),
  label VARCHAR(100) NOT NULL,
  slug VARCHAR(120) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(80) NOT NULL DEFAULT 'Package',
  has_mega_menu TINYINT(1) NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- The "Shop by type" groups inside a mega menu panel.
CREATE TABLE mega_menu_sections (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nav_item_id INTEGER NOT NULL REFERENCES nav_items(id) ON DELETE CASCADE,
  group_label VARCHAR(100) NOT NULL DEFAULT 'Shop by type',
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description VARCHAR(300),
  icon VARCHAR(80) NOT NULL DEFAULT 'Package',
  image TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (nav_item_id, slug),
  UNIQUE (id, nav_item_id)
);

CREATE TABLE products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) UNIQUE NOT NULL,
  sku VARCHAR(60) UNIQUE,
  description TEXT,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  subcategory_id INTEGER REFERENCES subcategories(id) ON DELETE SET NULL,
  navbar VARCHAR(20) CHECK (navbar IN ('top_bar', 'category_bar')),
  nav_item_id INTEGER REFERENCES nav_items(id) ON DELETE SET NULL,
  mega_section_id INTEGER,
  is_new TINYINT(1) NOT NULL DEFAULT FALSE,
  is_featured TINYINT(1) NOT NULL DEFAULT FALSE,
  -- Made-to-measure: the storefront shows "Request a Quote" instead of a cart
  -- button, so it has no fixed price.
  is_custom TINYINT(1) NOT NULL DEFAULT FALSE,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  image_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT products_mega_section_item_fk
    FOREIGN KEY (mega_section_id, nav_item_id)
    REFERENCES mega_menu_sections(id, nav_item_id) ON DELETE SET NULL
);

-- Which menu a hand-picked product appears in, beyond its category.
CREATE TABLE product_placements (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  nav_item_id INTEGER NOT NULL REFERENCES nav_items(id) ON DELETE CASCADE,
  mega_section_id INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mega_section_id, nav_item_id)
    REFERENCES mega_menu_sections(id, nav_item_id) ON DELETE CASCADE
);

CREATE TABLE product_images (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  position INTEGER DEFAULT 0
);

CREATE TABLE product_variants (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_name VARCHAR(100),
  color VARCHAR(50),
  price_modifier NUMERIC(10,2) DEFAULT 0,
  image_url TEXT
);

-- Shoppers. A guest checkout leaves no row here; the order keeps the details.
CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150),
  phone VARCHAR(32),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cart_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER DEFAULT 1,
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(20) UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- Kept on the order as given at checkout: the account may not exist and the
  -- phone number is what the workshop calls.
  customer_name VARCHAR(150),
  customer_phone VARCHAR(32),
  customer_email VARCHAR(255),
  delivery_district VARCHAR(100),
  delivery_sector VARCHAR(100),
  delivery_landmark VARCHAR(255),
  delivery_note TEXT,
  payment_method VARCHAR(40),
  -- Internal notes an admin adds while handling the order.
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Name and price are copied onto the order so it still reads correctly if the
-- product is renamed or deleted later.
CREATE TABLE order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE SET NULL,
  product_name VARCHAR(150),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0)
);

-- "Get a Quote" enquiries, for the custom-furniture flow.
CREATE TABLE quote_requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  company VARCHAR(150),
  project_type VARCHAR(100),
  budget VARCHAR(50),
  timeline VARCHAR(100),
  message TEXT,
  product_slug VARCHAR(150),
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Read-heavy storefront queries sort and filter on these.
CREATE INDEX idx_nav_items_order ON nav_items(navbar, sort_order, id);
CREATE INDEX idx_mega_sections_order ON mega_menu_sections(nav_item_id, sort_order, id);
CREATE INDEX idx_product_placements_nav ON product_placements(nav_item_id, mega_section_id, product_id);
CREATE UNIQUE INDEX idx_product_placements_unique
  ON product_placements(product_id, nav_item_id, COALESCE(mega_section_id, 0));
CREATE INDEX idx_subcategories_category ON subcategories(category_id, position);
CREATE INDEX idx_menu_images_category ON menu_images(category_id, sort_order, id);
CREATE INDEX idx_gallery_items_order ON gallery_items(sort_order, id);
CREATE INDEX idx_gallery_items_published ON gallery_items(is_published, sort_order);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_subcategory ON products(subcategory_id);
CREATE INDEX idx_products_status ON products(status, created_at);
CREATE INDEX idx_products_featured ON products(is_featured);
CREATE INDEX idx_products_new ON products(is_new);
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_product_images_product ON product_images(product_id, position);
CREATE INDEX idx_product_variants_product ON product_variants(product_id);
CREATE INDEX idx_cart_items_user ON cart_items(user_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status, created_at DESC);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_quote_requests_status ON quote_requests(status, created_at DESC);

-- ============================================================================
-- Admin: roles, permissions, staff sign-in, audit, settings, media, content
--
-- This mirrors db/admin-schema.sql. It is separate from the public `users`
-- table on purpose: a shopper account and a staff account must never be the
-- same row, and a staff login must never be possible against `users`.
-- ============================================================================

-- ---------- roles & permissions ----------
CREATE TABLE roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(60) UNIQUE NOT NULL,
  slug VARCHAR(60) UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  key VARCHAR(80) UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE role_permissions (
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ---------- staff ----------
-- `username` is the human-facing login handle and is unique case-insensitively;
-- `email` stays unique and is also accepted by the login form, so either works.
-- `status` is the source of truth; `is_active` mirrors it (see triggers below).
CREATE TABLE staff_users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(150),
  role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  username VARCHAR(60) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'invited')),
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usernames are unique, but only case-insensitively — "Agnes" and "agnes" must
-- not both be creatable. A plain UNIQUE constraint would allow that.
CREATE UNIQUE INDEX idx_staff_users_username ON staff_users (LOWER(username));

-- Keep the legacy TINYINT(1) mirroring `status`, stamp `updated_at`, and derive a
-- login handle when the caller did not supply one.
CREATE OR REPLACE FUNCTION staff_users_before_write() RETURNS trigger AS $$
BEGIN
  IF NEW.username IS NULL OR NEW.username = '' THEN
    NEW.username := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g'));
  ELSE
    NEW.username := LOWER(TRIM(NEW.username));
  END IF;
  NEW.is_active := (NEW.status = 'active');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staff_users_before_write ON staff_users;
CREATE TRIGGER trg_staff_users_before_write
  BEFORE INSERT OR UPDATE ON staff_users
  FOR EACH ROW EXECUTE FUNCTION staff_users_before_write();

CREATE TABLE sessions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  user_agent TEXT,
  ip VARCHAR(64),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE password_resets (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_id INTEGER NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drives the account lockout: 5 failures inside 15 minutes locks that email for
-- 15 minutes. It is a table, not an in-process counter, so a lockout survives
-- a restart and can be cleared by an admin.
CREATE TABLE login_attempts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255),
  ip VARCHAR(64),
  success TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- audit ----------
CREATE TABLE audit_logs (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  staff_id INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  staff_email VARCHAR(255),
  action VARCHAR(40) NOT NULL,
  entity VARCHAR(60),
  entity_id VARCHAR(60),
  before_data JSONB,
  after_data JSONB,
  ip VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------- settings ----------
CREATE TABLE settings (
  key VARCHAR(80) PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255)
);

-- ---------- media library ----------
-- Every public image is one row addressed by a stable slot key (`hero_slide_1`,
-- `logo`, …), so replacing a picture is a database update. A slot with a NULL
-- image_url is not an error: the storefront renders a placeholder.
CREATE TABLE media_slots (
  slot_key VARCHAR(80) PRIMARY KEY,
  label VARCHAR(120) NOT NULL,
  group_name VARCHAR(60) NOT NULL DEFAULT 'general',
  kind VARCHAR(20) NOT NULL DEFAULT 'photo',
  image_url TEXT,
  thumb_url TEXT,
  variant_400_url TEXT,
  variant_1200_url TEXT,
  variant_2560_url TEXT,
  variant_3840_url TEXT,
  alt_text VARCHAR(300),
  width INTEGER,
  height INTEGER,
  bytes INTEGER,
  original_width INTEGER,
  original_height INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255)
);

-- Every file the admin has ever uploaded, whether or not it is still assigned
-- to a slot, so an image can be re-assigned or rolled back without a re-upload.
CREATE TABLE media_uploads (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  thumb_url TEXT,
  variant_400_url TEXT,
  variant_1200_url TEXT,
  variant_2560_url TEXT,
  variant_3840_url TEXT,
  original_name VARCHAR(255),
  mime VARCHAR(40),
  alt_text VARCHAR(300),
  bytes INTEGER,
  width INTEGER,
  height INTEGER,
  original_width INTEGER,
  original_height INTEGER,
  original_path TEXT,
  quality VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(255)
);

-- ---------- content ----------
CREATE TABLE banners (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  subtitle TEXT,
  image_url TEXT,
  link_url TEXT,
  position INTEGER DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  starts_at TIMESTAMP,
  ends_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE pages (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  slug VARCHAR(150) UNIQUE NOT NULL,
  body TEXT,
  is_published TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE announcements (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  body TEXT,
  link_url TEXT,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE quote_notes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  quote_id INTEGER NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  staff_id INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_roles_permissions ON role_permissions(permission_id);
CREATE INDEX idx_staff_users_role ON staff_users(role_id);
CREATE INDEX idx_sessions_staff ON sessions(staff_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);
CREATE INDEX idx_password_resets_staff ON password_resets(staff_id);
CREATE INDEX idx_login_attempts_lookup ON login_attempts(email, created_at DESC);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity, entity_id);
CREATE INDEX idx_audit_logs_staff ON audit_logs(staff_id);
CREATE INDEX idx_media_slots_group ON media_slots(group_name, position);
CREATE INDEX idx_media_uploads_created ON media_uploads(created_at DESC);
CREATE INDEX idx_banners_active ON banners(is_active, position);
CREATE INDEX idx_announcements_active ON announcements(is_active);
CREATE INDEX idx_quote_notes_quote ON quote_notes(quote_id);
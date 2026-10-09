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
CREATE OR REPLACE FUNCTION staff_users_before_write() RETURNS trigger AS 
BEGIN
  IF NEW.username IS NULL OR NEW.username = '' THEN
    NEW.username := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g'));
  ELSE
    NEW.username := LOWER(TRIM(NEW.username));
  END IF;
  NEW.is_active := (NEW.status = 'active');
  NEW.updated_at := NOW();
  RETURN NEW;

 LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staff_users_before_write ON staff_users;
ers a placeholder.
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
-- Agati Furniture — seed data (MySQL / MariaDB)
--
-- Structure only: the ten storefront categories, one navigation entry per
-- category so the mega menus have something to open, a few "Shop by type"
-- sections, and the roles/permissions the admin sign-in checks against.
--
-- No products, no orders, no fake customers: those are real business data and
-- are added through the admin. install.php creates the admin account separately
-- and asks for its password rather than shipping one in a public repo.
--
-- Load this after schema.sql, and only on a database that is about to go live.

INSERT INTO categories (id, name, slug, description, icon, sort_order, is_active) VALUES
  (1, 'Living Room',  'living-room',  'Sofas, coffee tables and TV units built for the way you actually sit.', 'Sofa',   1, 1),
  (2, 'Bedroom',      'bedroom',      'Beds, wardrobes, bedside tables and dressing tables.',                'Bed',    2, 1),
  (3, 'Office',       'office',       'Desks, office chairs, bookcases and filing units.',                    'Table',  3, 1),
  (4, 'Dining Room',  'dining-room',  'Dining tables, dining chairs, sideboards and buffets.',                'UtensilsCrossed', 4, 1),
  (5, 'Kitchen',      'kitchen',      'Kitchen cabinets, islands, shelving and storage units.',                 'CookingPot', 5, 1),
  (6, 'Outdoor',      'outdoor',      'Garden furniture, patio sets and outdoor storage.',                     'TreePalm', 6, 1),
  (7, 'Chairs & Seating', 'chairs-seating', 'Office chairs, dining chairs, bar stools and lounge seating.',   'Armchair', 7, 1),
  (8, 'Storage & Shelving', 'storage-shelving', 'Wardrobes, bookshelves, shoe racks and modular storage.',   'Boxes', 8, 1),
  (9, 'Kids & Nursery', 'kids-nursery', 'Kids beds, study desks, toy storage and nursery furniture.',          'Baby', 9, 1),
  (10, 'Custom Furniture', 'custom-furniture', 'Made-to-measure pieces, built after a site visit or a drawing.', 'Hammer', 10, 1);

-- One category-bar entry per category. has_mega_menu = 1 opens the panel with
-- its sections and pictures. The slug must match categories.slug: the
-- storefront joins the two tables on the slug, not on the id, because the two
-- id sequences are allowed to drift apart.
INSERT INTO nav_items (id, navbar, label, slug, description, icon, has_mega_menu, sort_order, is_active) VALUES
  (1, 'category_bar', 'Living Room', 'living-room',  'Sofas, coffee tables and TV units.', 'Sofa', 1, 1, 1),
  (2, 'category_bar', 'Bedroom',     'bedroom',      'Beds, wardrobes and bedside tables.', 'Bed', 1, 2, 1),
  (3, 'category_bar', 'Office',      'office',       'Desks, office chairs and bookcases.', 'Table', 1, 3, 1),
  (4, 'category_bar', 'Dining Room', 'dining-room',  'Dining tables, chairs and sideboards.', 'UtensilsCrossed', 1, 4, 1),
  (5, 'category_bar', 'Kitchen',     'kitchen',      'Kitchen cabinets, islands and shelving.', 'CookingPot', 1, 5, 1),
  (6, 'category_bar', 'Outdoor',     'outdoor',      'Garden furniture and patio sets.', 'TreePalm', 1, 6, 1),
  (7, 'category_bar', 'Chairs & Seating', 'chairs-seating', 'Office, dining and lounge chairs.', 'Armchair', 1, 7, 1),
  (8, 'category_bar', 'Storage & Shelving', 'storage-shelving', 'Wardrobes, shelves and storage.', 'Boxes', 1, 8, 1),
  (9, 'category_bar', 'Kids & Nursery', 'kids-nursery', 'Kids beds, study desks and toy storage.', 'Baby', 1, 9, 1),
  (10, 'category_bar', 'Custom Furniture', 'custom-furniture', 'Made to measure, quoted per project.', 'Hammer', 1, 10, 1),
  (11, 'top_bar', 'Home', 'home', 'Back to the home page.', 'House', 0, 1, 1),
  (12, 'top_bar', 'Custom Furniture', 'top-custom-furniture', 'Made-to-measure pieces.', 'Hammer', 0, 2, 1),
  (13, 'top_bar', 'Contact us', 'contact-us', 'Talk to the workshop.', 'Phone', 0, 3, 1);

-- The "Shop by type" groups shown inside each panel.
INSERT INTO mega_menu_sections (nav_item_id, group_label, name, slug, description, icon, sort_order, is_active) VALUES
  (1, 'Shop by type', 'Sofas & Sectionals', 'living-room-sofas', 'Three-seat, two-seat and chaise.', 'Sofa', 1, 1),
  (1, 'Shop by type', 'Coffee Tables', 'living-room-coffee-tables', 'Wood, glass and marble tops.', 'Table', 2, 1),
  (1, 'Shop by type', 'TV Units', 'living-room-tv-units', 'Lowboards and wall units.', 'Tv', 3, 1),
  (2, 'Shop by type', 'Beds & Bed Frames', 'bedroom-beds', 'Single, double, queen and king.', 'Bed', 1, 1),
  (2, 'Shop by type', 'Wardrobes', 'bedroom-wardrobes', 'Sliding and hinged.', 'DoorClosed', 2, 1),
  (2, 'Shop by type', 'Bedside Tables', 'bedroom-bedside-tables', 'With and without drawers.', 'Table', 3, 1),
  (3, 'Shop by type', 'Desks', 'office-desks', 'Standing and fixed height.', 'Table', 1, 1),
  (3, 'Shop by type', 'Office Chairs', 'office-chairs', 'Executive and mesh-back.', 'Armchair', 2, 1),
  (3, 'Shop by type', 'Bookcases', 'office-bookcases', 'Open shelving and closed units.', 'BookOpen', 3, 1),
  (4, 'Shop by type', 'Dining Tables', 'dining-tables', 'Seats four to ten.', 'Utensils', 1, 1),
  (4, 'Shop by type', 'Dining Chairs', 'dining-chairs', 'Solid, upholstered and stackable.', 'Armchair', 2, 1),
  (4, 'Shop by type', 'Sideboards', 'dining-sideboards', 'Buffets and servers.', 'Boxes', 3, 1),
  (5, 'Shop by type', 'Cabinets', 'kitchen-cabinets', 'Base and wall units.', 'CookingPot', 1, 1),
  (5, 'Shop by type', 'Kitchen Islands', 'kitchen-islands', 'With seating overhang.', 'CookingPot', 2, 1),
  (5, 'Shop by type', 'Shelving', 'kitchen-shelving', 'Open racks and cupboards.', 'Boxes', 3, 1),
  (6, 'Shop by type', 'Garden Sets', 'outdoor-sets', 'Four to eight seater.', 'TreePalm', 1, 1),
  (6, 'Shop by type', 'Patio Tables', 'outdoor-tables', 'Teak and all-weather.', 'Table', 2, 1),
  (7, 'Shop by type', 'Office Chairs', 'chairs-office', 'Ergonomic and executive.', 'Armchair', 1, 1),
  (7, 'Shop by type', 'Dining Chairs', 'chairs-dining', 'Solid and upholstered.', 'Armchair', 2, 1),
  (8, 'Shop by type', 'Wardrobes', 'storage-wardrobes', 'Hinged and sliding.', 'DoorClosed', 1, 1),
  (8, 'Shop by type', 'Bookshelves', 'storage-bookshelves', 'Wall and free standing.', 'BookOpen', 2, 1),
  (9, 'Shop by type', 'Kids Beds', 'kids-beds', 'Bunk, single and toddler.', 'Bed', 1, 1),
  (9, 'Shop by type', 'Study Desks', 'kids-study-desks', 'Height adjustable.', 'Table', 2, 1),
  (10, 'Shop by type', 'Custom Sofas', 'custom-sofas', 'Built to your measurements.', 'Sofa', 1, 1),
  (10, 'Shop by type', 'Custom Tables', 'custom-tables', 'Any size, any timber.', 'Hammer', 2, 1);

-- Roles and permissions: the same fifteen permissions and four roles the
-- Next.js admin uses, so a role means the same thing on both stacks.
INSERT INTO permissions (`key`, description) VALUES
  ('dashboard.view', 'View the admin dashboard'),
  ('products.view', 'View products'),
  ('products.edit', 'Create, update and delete products'),
  ('orders.view', 'View orders'),
  ('orders.edit', 'Update order status and details'),
  ('customers.view', 'View customers'),
  ('customers.edit', 'Edit customer records'),
  ('quotes.view', 'View quote requests'),
  ('quotes.edit', 'Update quotes and add notes'),
  ('content.edit', 'Manage banners, pages and announcements'),
  ('media.edit', 'Upload and replace site images'),
  ('reports.view', 'View reports and analytics'),
  ('staff.view', 'View staff and roles'),
  ('staff.edit', 'Create staff and assign roles'),
  ('settings.edit', 'Change site settings');

INSERT INTO roles (id, name, slug, description) VALUES
  (1, 'Super Admin', 'super-admin', 'Full access to every part of the admin.'),
  (2, 'Admin', 'admin', 'Manages the catalogue, orders, customers and quotes.'),
  (3, 'Editor', 'editor', 'Runs the storefront: images, banners and pages. No orders, staff or settings.'),
  (4, 'Staff', 'staff', 'Day-to-day order and quote handling. Read-only catalogue.');

-- Super Admin holds every permission.
INSERT INTO role_permissions (role_id, permission_id)
  SELECT 1, id FROM permissions;

INSERT INTO role_permissions (role_id, permission_id)
  SELECT 2, id FROM permissions
   WHERE `key` IN ('dashboard.view','products.view','products.edit','orders.view','orders.edit',
                   'customers.view','customers.edit','quotes.view','quotes.edit','content.edit',
                   'media.edit','reports.view');

INSERT INTO role_permissions (role_id, permission_id)
  SELECT 3, id FROM permissions
   WHERE `key` IN ('dashboard.view','products.view','content.edit','media.edit');

INSERT INTO role_permissions (role_id, permission_id)
  SELECT 4, id FROM permissions
   WHERE `key` IN ('dashboard.view','products.view','orders.view','orders.edit',
                   'customers.view','quotes.view','quotes.edit');

-- Media slots the storefront reads. image_url stays NULL on a fresh install and
-- the storefront renders a placeholder; an admin fills these in.
INSERT INTO media_slots (slot_key, label, group_name, kind, position) VALUES
  ('logo', 'Logo', 'branding', 'photo', 1),
  ('hero_slide_1', 'Hero slide 1', 'homepage', 'photo', 1),
  ('hero_slide_2', 'Hero slide 2', 'homepage', 'photo', 2),
  ('hero_slide_3', 'Hero slide 3', 'homepage', 'photo', 3),
  ('page_hero_about', 'About page hero', 'pages', 'photo', 1),
  ('page_hero_contact', 'Contact page hero', 'pages', 'photo', 2);

-- A couple of real content rows so the storefront is not bare on first load.
INSERT INTO banners (title, subtitle, position, is_active) VALUES
  ('Made in Uganda', 'Solid timber furniture, built to order in our workshop.', 1, 1),
  ('Custom pieces', 'Send us your measurements and we will quote it.', 2, 1);

INSERT INTO pages (title, slug, body, is_published) VALUES
  ('About Agati Furniture', 'about', 'Agati Furniture is a workshop in Uganda making solid timber furniture: sofas, beds, dining sets, office desks and made-to-measure pieces.', 1);

INSERT INTO announcements (title, body, is_active) VALUES
  ('Free delivery within Kampala', 'On orders over UGX 500,000.', 1);
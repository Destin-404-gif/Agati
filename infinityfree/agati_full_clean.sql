-- Agati Furniture — MySQL / MariaDB schema
--
-- Production schema: InfinityFree runs MySQL, so this is the file imported
-- through phpMyAdmin (or run by install.php).
-- Charset utf8mb4 throughout, InnoDB for real foreign keys.
-- Idempotent: drops and recreates, so it is safe to re-run on an empty account.
--
-- The PostgreSQL twin lives in database/pgsql/schema.sql and has the same
-- tables, columns and indexes.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS quote_notes;
DROP TABLE IF EXISTS announcements;
DROP TABLE IF EXISTS pages;
DROP TABLE IF EXISTS banners;
DROP TABLE IF EXISTS media_uploads;
DROP TABLE IF EXISTS media_slots;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS login_attempts;
DROP TABLE IF EXISTS password_resets;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS staff_users;
DROP TABLE IF EXISTS roles;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS quote_requests;
DROP TABLE IF EXISTS product_variants;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS product_placements;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS menu_images;
DROP TABLE IF EXISTS subcategories;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS mega_menu_sections;
DROP TABLE IF EXISTS nav_items;
DROP TABLE IF EXISTS gallery_items;
DROP TABLE IF EXISTS users;
-- Top-level storefront categories. The navbar category bar is built from these
-- rows, so a category here is also a menu that can carry pictures.
CREATE TABLE categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT NULL,
  icon VARCHAR(80) NOT NULL DEFAULT 'Package',
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  image_url TEXT NULL,
  image_alt VARCHAR(300) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_slug (slug),
  KEY idx_categories_active (is_active, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Second level of the taxonomy. A separate table rather than a parent_id on
-- `categories`, because products reference categories.id directly.
CREATE TABLE subcategories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id INT UNSIGNED NOT NULL,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  icon VARCHAR(80) NOT NULL DEFAULT 'Package',
  image_url TEXT NULL,
  image_alt VARCHAR(300) NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_subcategories_category_slug (category_id, slug),
  KEY idx_subcategories_category (category_id, position),
  CONSTRAINT fk_subcategories_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Pictures for the empty right-hand column of each category mega menu.
-- At most three per category, enforced by the app: reorder rewrites sort_order
-- row by row and a unique key on (category_id, sort_order) would reject the
-- intermediate states of a swap.
CREATE TABLE menu_images (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id INT UNSIGNED NOT NULL,
  image_path VARCHAR(500) NOT NULL,
  caption VARCHAR(200) NULL,
  link_url VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_menu_images_category (category_id, sort_order, id),
  CONSTRAINT fk_menu_images_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Workshop gallery, managed from the admin.
CREATE TABLE gallery_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  image_url VARCHAR(500) NOT NULL,
  thumbnail_url VARCHAR(500) NULL,
  title VARCHAR(150) NULL,
  caption TEXT NULL,
  alt_text VARCHAR(300) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_gallery_items_order (sort_order, id),
  KEY idx_gallery_items_published (is_published, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- The two navbar rows. `category_bar` entries with has_mega_menu = 1 open a
-- panel; `top_bar` entries are plain links.
CREATE TABLE nav_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  navbar VARCHAR(20) NOT NULL,
  label VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description VARCHAR(300) NULL,
  icon VARCHAR(80) NOT NULL DEFAULT 'Package',
  has_mega_menu TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_nav_items_slug (slug),
  KEY idx_nav_items_order (navbar, is_active, sort_order),
  CONSTRAINT chk_nav_items_navbar CHECK (navbar IN ('top_bar', 'category_bar'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- The "Shop by type" groups inside a mega menu panel.
CREATE TABLE mega_menu_sections (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nav_item_id INT UNSIGNED NOT NULL,
  group_label VARCHAR(100) NOT NULL DEFAULT 'Shop by type',
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL,
  description VARCHAR(300) NULL,
  icon VARCHAR(80) NOT NULL DEFAULT 'Package',
  image VARCHAR(500) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sections_nav_slug (nav_item_id, slug),
  UNIQUE KEY uq_sections_id_nav (id, nav_item_id),
  KEY idx_mega_sections_order (nav_item_id, sort_order, id),
  CONSTRAINT fk_sections_nav_item FOREIGN KEY (nav_item_id)
    REFERENCES nav_items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) NOT NULL,
  sku VARCHAR(60) NULL,
  description TEXT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  category_id INT UNSIGNED NULL,
  subcategory_id INT UNSIGNED NULL,
  navbar VARCHAR(20) NULL,
  nav_item_id INT UNSIGNED NULL,
  mega_section_id INT UNSIGNED NULL,
  is_new TINYINT(1) NOT NULL DEFAULT 0,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  -- Made-to-measure: the storefront shows "Request a Quote" instead of a cart
  -- button, so it has no fixed price.
  is_custom TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(30) NOT NULL DEFAULT 'active',
  stock_quantity INT NOT NULL DEFAULT 0,
  image_url VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_products_slug (slug),
  UNIQUE KEY uq_products_sku (sku),
  KEY idx_products_category (category_id),
  KEY idx_products_subcategory (subcategory_id),
  KEY idx_products_status (status, created_at),
  KEY idx_products_nav (nav_item_id, mega_section_id),
  KEY idx_products_featured (is_featured),
  KEY idx_products_new (is_new),
  CONSTRAINT fk_products_category FOREIGN KEY (category_id)
    REFERENCES categories (id) ON DELETE SET NULL,
  CONSTRAINT fk_products_subcategory FOREIGN KEY (subcategory_id)
    REFERENCES subcategories (id) ON DELETE SET NULL,
  CONSTRAINT fk_products_nav_item FOREIGN KEY (nav_item_id)
    REFERENCES nav_items (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- The (mega_section_id, nav_item_id) pair is kept consistent with
-- mega_menu_sections via its UNIQUE (id, nav_item_id) key.
ALTER TABLE products
  ADD CONSTRAINT fk_products_mega_section FOREIGN KEY (mega_section_id, nav_item_id)
    REFERENCES mega_menu_sections (id, nav_item_id) ON DELETE SET NULL;
-- Which menu a hand-picked product appears in, beyond its category.
CREATE TABLE product_placements (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  nav_item_id INT UNSIGNED NOT NULL,
  mega_section_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- MySQL treats NULLs as distinct in a unique index, so a product placed in a
  -- panel with no section could be listed twice. The generated column collapses
  -- NULL to 0 and gives the same guarantee as PostgreSQL's COALESCE index below.
  section_key INT UNSIGNED AS (IFNULL(mega_section_id, 0)) STORED,
  PRIMARY KEY (id),
  KEY idx_placement_nav (nav_item_id, mega_section_id, product_id),
  UNIQUE KEY uq_placement (product_id, nav_item_id, section_key),
  CONSTRAINT fk_placement_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_placement_item FOREIGN KEY (nav_item_id)
    REFERENCES nav_items (id) ON DELETE CASCADE,
  CONSTRAINT fk_placement_section FOREIGN KEY (mega_section_id, nav_item_id)
    REFERENCES mega_menu_sections (id, nav_item_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE product_images (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NULL,
  image_url VARCHAR(500) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_product_images_product (product_id, position),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE product_variants (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id INT UNSIGNED NOT NULL,
  variant_name VARCHAR(100) NULL,
  color VARCHAR(50) NULL,
  price_modifier DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  image_url VARCHAR(500) NULL,
  PRIMARY KEY (id),
  KEY idx_product_variants_product (product_id),
  CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Shoppers. A guest checkout leaves no row here; the order keeps the details.
CREATE TABLE users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NULL,
  phone VARCHAR(32) NULL,
  address TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE cart_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NULL,
  product_id INT UNSIGNED NULL,
  variant_id INT UNSIGNED NULL,
  quantity INT NOT NULL DEFAULT 1,
  added_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cart_items_user (user_id),
  KEY idx_cart_items_product (product_id),
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE CASCADE,
  CONSTRAINT fk_cart_variant FOREIGN KEY (variant_id)
    REFERENCES product_variants (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_number VARCHAR(20) NULL,
  user_id INT UNSIGNED NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  -- Kept on the order as given at checkout: the account may not exist and the
  -- phone number is what the workshop calls.
  customer_name VARCHAR(150) NULL,
  customer_phone VARCHAR(32) NULL,
  customer_email VARCHAR(255) NULL,
  delivery_district VARCHAR(100) NULL,
  delivery_sector VARCHAR(100) NULL,
  delivery_landmark VARCHAR(255) NULL,
  delivery_note TEXT NULL,
  payment_method VARCHAR(40) NULL,
  -- Internal notes an admin adds while handling the order.
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_order_number (order_number),
  KEY idx_orders_user (user_id),
  KEY idx_orders_status (status, created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- Name and price are copied onto the order so it still reads correctly if the
-- product is renamed or deleted later.
CREATE TABLE order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NULL,
  variant_id INT UNSIGNED NULL,
  product_name VARCHAR(150) NULL,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  PRIMARY KEY (id),
  KEY idx_order_items_order (order_id),
  CONSTRAINT chk_order_items_quantity CHECK (quantity > 0),
  CONSTRAINT chk_order_items_price CHECK (unit_price >= 0),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id)
    REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id)
    REFERENCES products (id) ON DELETE SET NULL,
  CONSTRAINT fk_order_items_variant FOREIGN KEY (variant_id)
    REFERENCES product_variants (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- "Get a Quote" enquiries, for the custom-furniture flow.
CREATE TABLE quote_requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(50) NULL,
  company VARCHAR(150) NULL,
  project_type VARCHAR(100) NULL,
  budget VARCHAR(50) NULL,
  timeline VARCHAR(100) NULL,
  message TEXT NULL,
  product_slug VARCHAR(150) NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_quote_requests_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ============================================================================
-- Admin: roles, permissions, staff sign-in, audit, settings, media, content
--
-- This mirrors db/admin-schema.sql. It is separate from the public `users`
-- table on purpose: a shopper account and a staff account must never be the
-- same row, and a staff login must never be possible against `users`.
-- ============================================================================
-- ---------- roles & permissions ----------
CREATE TABLE roles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(60) NOT NULL,
  slug VARCHAR(60) NOT NULL,
  description TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_name (name),
  UNIQUE KEY uq_roles_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- `key` is a reserved word in MySQL (it is a keyword in the column list), so it
-- is backticked here and in every query that touches it. PostgreSQL does not
-- need quoting, which is why the two schema files look slightly different.
CREATE TABLE permissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `key` VARCHAR(80) NOT NULL,
  description TEXT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_permissions_key (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE role_permissions (
  role_id INT UNSIGNED NOT NULL,
  permission_id INT UNSIGNED NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  KEY idx_role_permissions_permission (permission_id),
  CONSTRAINT fk_role_permissions_role FOREIGN KEY (role_id)
    REFERENCES roles (id) ON DELETE CASCADE,
  CONSTRAINT fk_role_permissions_permission FOREIGN KEY (permission_id)
    REFERENCES permissions (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
-- ---------- staff ----------
-- `username` is the human-facing login handle and is unique case-insensitively;
-- `email` stays unique and is also accepted by the login form, so either works.
-- utf8mb4_unicode_ci already makes `username` case-insensitive, so a plain
-- unique key is enough here where PostgreSQL needed an index on LOWER(username).
-- `status` is the source of truth; `is_active` mirrors it (see triggers below).
CREATE TABLE staff_users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NULL,
  role_id INT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  username VARCHAR(60) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_users_email (email),
  UNIQUE KEY uq_staff_users_username (username),
  KEY idx_staff_users_role (role_id),
  CONSTRAINT fk_staff_users_role FOREIGN KEY (role_id)
    REFERENCES roles (id) ON DELETE SET NULL,
  CONSTRAINT chk_staff_users_status CHECK (status IN ('active', 'suspended', 'invited'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

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

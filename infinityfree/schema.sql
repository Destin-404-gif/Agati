SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS product_placements;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS mega_menu_sections;
DROP TABLE IF EXISTS nav_items;
DROP TABLE IF EXISTS quote_requests;
DROP TABLE IF EXISTS gallery_items;
DROP TABLE IF EXISTS staff_users;

CREATE TABLE nav_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  navbar ENUM('top_bar','category_bar') NOT NULL,
  label VARCHAR(100) NOT NULL,
  slug VARCHAR(120) NOT NULL UNIQUE,
  description VARCHAR(300) NULL,
  icon VARCHAR(80) NOT NULL DEFAULT 'Package',
  has_mega_menu TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_nav_items_order (navbar, is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mega_menu_sections (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
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
  UNIQUE KEY uq_section_slug (nav_item_id, slug),
  KEY idx_sections_order (nav_item_id, is_active, sort_order),
  CONSTRAINT fk_sections_nav_item FOREIGN KEY (nav_item_id) REFERENCES nav_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  slug VARCHAR(150) NOT NULL UNIQUE,
  sku VARCHAR(60) NULL UNIQUE,
  description TEXT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  image_url VARCHAR(500) NULL,
  status ENUM('active','draft','archived') NOT NULL DEFAULT 'active',
  stock_quantity INT NOT NULL DEFAULT 0,
  is_new TINYINT(1) NOT NULL DEFAULT 0,
  is_featured TINYINT(1) NOT NULL DEFAULT 0,
  is_custom TINYINT(1) NOT NULL DEFAULT 0,
  navbar ENUM('top_bar','category_bar') NULL,
  nav_item_id INT UNSIGNED NULL,
  mega_section_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_products_status (status, created_at),
  KEY idx_products_nav (nav_item_id, mega_section_id),
  CONSTRAINT fk_products_nav_item FOREIGN KEY (nav_item_id) REFERENCES nav_items(id) ON DELETE SET NULL,
  CONSTRAINT fk_products_section FOREIGN KEY (mega_section_id) REFERENCES mega_menu_sections(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_placements (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  nav_item_id INT UNSIGNED NOT NULL,
  mega_section_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_placement_nav (nav_item_id, mega_section_id, product_id),
  CONSTRAINT fk_placement_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  CONSTRAINT fk_placement_item FOREIGN KEY (nav_item_id) REFERENCES nav_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_placement_section FOREIGN KEY (mega_section_id) REFERENCES mega_menu_sections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_images (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  product_id INT UNSIGNED NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  position INT NOT NULL DEFAULT 0,
  KEY idx_product_images_product (product_id, position),
  CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE staff_users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(60) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(150) NULL,
  status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE gallery_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  image_url VARCHAR(500) NOT NULL,
  title VARCHAR(150) NULL,
  caption TEXT NULL,
  alt_text VARCHAR(300) NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_published TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_gallery_order (is_published, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE quote_requests (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(40) NULL,
  project_type VARCHAR(100) NULL,
  message TEXT NOT NULL,
  status ENUM('new','replied','closed') NOT NULL DEFAULT 'new',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_quotes_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE orders (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_number VARCHAR(24) NOT NULL UNIQUE,
  customer_name VARCHAR(150) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  delivery_address TEXT NOT NULL,
  delivery_note TEXT NULL,
  payment_method VARCHAR(40) NOT NULL DEFAULT 'cash_on_delivery',
  status ENUM('pending','processing','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  total DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_orders_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id INT UNSIGNED NOT NULL,
  product_id INT UNSIGNED NULL,
  product_name VARCHAR(150) NOT NULL,
  image_url VARCHAR(500) NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO nav_items (navbar, label, slug, icon, has_mega_menu, sort_order) VALUES
('top_bar','New Arrivals','new-arrivals','Sparkles',0,0),
('top_bar','Best Sellers','best-sellers','TrendingUp',0,1),
('top_bar','Offers','offers','BadgePercent',0,2),
('top_bar','Projects','projects','PanelsTopLeft',0,3),
('top_bar','Gallery','gallery','Images',0,4),
('top_bar','About','about','Info',0,5),
('top_bar','Contact','contact','Mail',0,6),
('category_bar','Living Room','living-room','Sofa',1,0),
('category_bar','Bedroom','bedroom','BedDouble',1,1),
('category_bar','Office','office','Briefcase',1,2),
('category_bar','Dining Room','dining-room','UtensilsCrossed',1,3),
('category_bar','Kitchen','kitchen','ChefHat',1,4),
('category_bar','Outdoor','outdoor','TreePine',1,5),
('category_bar','Chairs & Seating','chairs-seating','Armchair',1,6),
('category_bar','Storage & Shelving','storage-shelving','Library',1,7),
('category_bar','Kids & Nursery','kids-nursery','Baby',1,8),
('category_bar','Custom Furniture','custom-furniture','Ruler',1,9);

INSERT INTO mega_menu_sections (nav_item_id, group_label, name, slug, description, icon, sort_order)
SELECT n.id, seed.group_label, seed.name, seed.slug, seed.description, seed.icon, seed.sort_order
FROM nav_items n
JOIN (
  SELECT 'living-room' nav_slug,'Shop by type' group_label,'Sofas' name,'sofas' slug,'Three-seaters cut low and deep for long evenings.' description,'Sofa' icon,0 sort_order UNION ALL
  SELECT 'living-room','Shop by type','Armchairs','armchairs','Reading chairs built for hours of sitting.','Armchair',1 UNION ALL
  SELECT 'living-room','Shop by type','Coffee tables','coffee-tables','The centre of gravity for the room.','Table',2 UNION ALL
  SELECT 'living-room','Storage & display','TV stands','tv-stands','Cable-savvy storage for your screen.','Tv',3 UNION ALL
  SELECT 'bedroom','Sleep','Beds & frames','beds-bed-frames','Platform and sleigh beds cut as one piece.','BedDouble',0 UNION ALL
  SELECT 'bedroom','Sleep','Wardrobes','wardrobes','Floor-to-ceiling storage, fitted to your room.','Archive',1 UNION ALL
  SELECT 'bedroom','Bedside & storage','Bedside tables','bedside-tables','A small shelf for the daily essentials.','Lamp',2 UNION ALL
  SELECT 'office','Workspace','Office desks','office-desks','Solid-top desks built for real work.','Table',0 UNION ALL
  SELECT 'office','Workspace','Office chairs','office-chairs','Comfortable seating for the working day.','Armchair',1 UNION ALL
  SELECT 'office','Meetings','Meeting tables','meeting-tables','Tables for teams and clients.','Table2',2 UNION ALL
  SELECT 'dining-room','Dining','Dining tables','dining-tables','Tables sized to your room and household.','Table2',0 UNION ALL
  SELECT 'dining-room','Dining','Dining chairs','dining-chairs','Matched seating for long meals.','Armchair',1 UNION ALL
  SELECT 'dining-room','Serving','Sideboards & buffets','sideboards-buffets','Low storage for the serving line.','PanelLeft',2 UNION ALL
  SELECT 'kitchen','Cabinetry','Kitchen cabinets','kitchen-cabinets','Cabinetry fitted to your kitchen.','ChefHat',0 UNION ALL
  SELECT 'kitchen','Cabinetry','Islands','kitchen-islands','Prep and dining in one solid block.','Cuboid',1 UNION ALL
  SELECT 'outdoor','Garden','Outdoor tables','outdoor-tables','Weather-ready tables for the garden.','Table2',0 UNION ALL
  SELECT 'outdoor','Garden','Outdoor chairs','outdoor-chairs','Outdoor seating built to last.','Armchair',1 UNION ALL
  SELECT 'chairs-seating','Seating','Armchairs','armchairs','Reading chairs built for hours of sitting.','Armchair',0 UNION ALL
  SELECT 'storage-shelving','Storage','Bookshelves','bookshelves','Storage sized for your space and collection.','BookOpen',0 UNION ALL
  SELECT 'kids-nursery','Sleep & study','Bunk beds','bunk-beds','Two storeys of sleep and one ladder away.','BedSingle',0 UNION ALL
  SELECT 'custom-furniture','Made for you','Custom tables','custom-tables','Any length, timber, and finish.','Table2',0
) AS seed ON seed.nav_slug = n.slug;

SET FOREIGN_KEY_CHECKS = 1;
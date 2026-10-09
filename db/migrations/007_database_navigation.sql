-- Database-managed navigation and product placements.
CREATE TABLE IF NOT EXISTS nav_items (
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

CREATE TABLE IF NOT EXISTS mega_menu_sections (
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

ALTER TABLE products ADD COLUMN IF NOT EXISTS navbar VARCHAR(20);
ALTER TABLE products ADD COLUMN IF NOT EXISTS nav_item_id INTEGER REFERENCES nav_items(id) ON DELETE SET NULL;
ALTER TABLE products ADD COLUMN IF NOT EXISTS mega_section_id INTEGER;
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_navbar_check
    CHECK (navbar IS NULL OR navbar IN ('top_bar', 'category_bar'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_mega_section_item_fk
    FOREIGN KEY (mega_section_id, nav_item_id)
    REFERENCES mega_menu_sections(id, nav_item_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS product_placements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  nav_item_id INTEGER NOT NULL REFERENCES nav_items(id) ON DELETE CASCADE,
  mega_section_id INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  FOREIGN KEY (mega_section_id, nav_item_id)
    REFERENCES mega_menu_sections(id, nav_item_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_nav_items_order ON nav_items(navbar, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_mega_sections_order ON mega_menu_sections(nav_item_id, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_product_placements_nav ON product_placements(nav_item_id, mega_section_id, product_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_placements_unique
  ON product_placements(product_id, nav_item_id, COALESCE(mega_section_id, 0));

INSERT INTO nav_items (navbar, label, slug, icon, has_mega_menu, sort_order)
VALUES
  ('top_bar', 'New Arrivals', 'new-arrivals', 'Sparkles', FALSE, 0),
  ('top_bar', 'Best Sellers', 'best-sellers', 'TrendingUp', FALSE, 1),
  ('top_bar', 'Offers', 'offers', 'BadgePercent', FALSE, 2),
  ('top_bar', 'Projects', 'projects', 'PanelsTopLeft', FALSE, 3),
  ('top_bar', 'Gallery', 'gallery', 'Images', FALSE, 4),
  ('top_bar', 'About', 'about', 'Info', FALSE, 5),
  ('top_bar', 'Contact', 'contact', 'Mail', FALSE, 6),
  ('category_bar', 'Living Room', 'living-room', 'Sofa', TRUE, 0),
  ('category_bar', 'Bedroom', 'bedroom', 'BedDouble', TRUE, 1),
  ('category_bar', 'Office', 'office', 'Briefcase', TRUE, 2),
  ('category_bar', 'Dining Room', 'dining-room', 'UtensilsCrossed', TRUE, 3),
  ('category_bar', 'Kitchen', 'kitchen', 'ChefHat', TRUE, 4),
  ('category_bar', 'Outdoor', 'outdoor', 'TreePine', TRUE, 5),
  ('category_bar', 'Chairs & Seating', 'chairs-seating', 'Armchair', TRUE, 6),
  ('category_bar', 'Storage & Shelving', 'storage-shelving', 'Library', TRUE, 7),
  ('category_bar', 'Kids & Nursery', 'kids-nursery', 'Baby', TRUE, 8),
  ('category_bar', 'Custom Furniture', 'custom-furniture', 'Ruler', TRUE, 9)
ON CONFLICT (slug) DO NOTHING;

WITH sections(nav_slug, group_label, name, slug, description, icon, sort_order) AS (
  VALUES
    ('living-room','Shop by type','Sofas','sofas','Three-seaters cut low and deep for long evenings.','Sofa',0),
    ('living-room','Shop by type','Armchairs','armchairs','Reading chairs built to be sat in for hours.','Armchair',1),
    ('living-room','Shop by type','Coffee tables','coffee-tables','The centre of gravity for the whole room.','Table',2),
    ('living-room','Storage & display','TV stands','tv-stands-units','Cable-savvy storage that tucks the screen away.','Tv',3),
    ('living-room','Storage & display','Display cabinets','display-cabinets','Glass-fronted cases for the things you keep.','GalleryVerticalEnd',4),
    ('bedroom','Sleep','Beds & frames','beds-bed-frames','Platform, low or sleigh, cut as one piece.','BedDouble',0),
    ('bedroom','Sleep','Wardrobes','wardrobes','Floor-to-ceiling storage with an interior fit-out.','Archive',1),
    ('bedroom','Bedside & storage','Bedside tables','bedside-tables','Small shelves for a book, a clock and a cup.','Lamp',2),
    ('bedroom','Bedside & storage','Dressing tables','dressing-tables','Vanity height, with drawers for the daily kit.','LampDesk',3),
    ('office','Workspace','Office desks','office-desks','Solid-top desks wired for real work.','Table',0),
    ('office','Workspace','Office chairs','office-chairs','Ergonomic, upholstered, on quiet casters.','Armchair',1),
    ('office','Meetings & reception','Meeting tables','meeting-tables','Rounds, boats and racetracks for the boardroom.','Table2',2),
    ('office','Meetings & reception','Filing cabinets','filing-cabinets','Lateral, lockable, feather-smooth drawers.','Boxes',3),
    ('dining-room','Dining','Dining tables','dining-tables','Round, refectory or extendable to seat the guests.','Table2',0),
    ('dining-room','Dining','Dining chairs','dining-chairs','Matched to your table, comfortable all evening.','Armchair',1),
    ('dining-room','Serving & bar','Sideboards & buffets','sideboards-buffets','Low storage for the serving line.','PanelLeft',2),
    ('dining-room','Serving & bar','Bar stools','bar-stools','Counter-height, foot-railed, warm to the touch.','Shapes',3),
    ('kitchen','Cabinetry','Kitchen cabinets','kitchen-cabinets','Cut from one timber run, fitted with soft-close.','ChefHat',0),
    ('kitchen','Cabinetry','Islands','kitchen-islands','Prep, sit and eat at the one solid block.','Cuboid',1),
    ('kitchen','Cabinetry','Pantry storage','pantry-storage','Everything reachable, nothing wasted.','Boxes',2),
    ('kitchen','Eating areas','Breakfast tables','breakfast-tables','Two or four seats for the first cup.','Table',3),
    ('outdoor','Dining & lounging','Outdoor tables','outdoor-tables','Weather-proof tops that shrug off the rain.','Table2',0),
    ('outdoor','Dining & lounging','Outdoor chairs','outdoor-chairs','Stackable seating for the deck and lawn.','Armchair',1),
    ('outdoor','Garden & patio','Garden benches','garden-benches','A sweep of solid timber for the quiet corner.','Trees',2),
    ('outdoor','Garden & patio','Outdoor storage','outdoor-storage','Sealed boxes for the cushions and tools.','SquareStack',3),
    ('chairs-seating','Everyday seating','Armchairs','armchairs','Reading chairs built to be sat in for hours.','Armchair',0),
    ('chairs-seating','Everyday seating','Dining chairs','dining-chairs','Matched to your table, comfortable all evening.','Armchair',1),
    ('chairs-seating','Work & bar seating','Office chairs','office-chairs','Ergonomic, upholstered, on quiet casters.','Armchair',2),
    ('chairs-seating','Work & bar seating','Bar stools','bar-stools','Counter-height, foot-railed, warm to the touch.','Shapes',3),
    ('storage-shelving','Cabinets','Cabinets','cabinets','Closed fronts, slow-hinged, timber inside and out.','Archive',0),
    ('storage-shelving','Cabinets','Wardrobes','wardrobes','Floor-to-ceiling storage with an interior fit-out.','SquareStack',1),
    ('storage-shelving','Shelving','Bookshelves','bookshelves','Runs sized to the book, not to the box.','BookOpen',2),
    ('storage-shelving','Shelving','Shelving units','shelving-units','Open frames for records, plants and the everyday.','Rows3',3),
    ('kids-nursery','Sleep & study','Children''s beds','childrens-beds','Low, rounded and built to be jumped on.','Bed',0),
    ('kids-nursery','Sleep & study','Bunk beds','bunk-beds','Two storeys of sleep, one always a ladder away.','BedSingle',1),
    ('kids-nursery','Sleep & study','Study desks','study-desks','A desk that grows with the years of homework.','Monitor',2),
    ('kids-nursery','Storage','Toy storage','toy-storage','Soft-close boxes, low to the ground.','Package',3),
    ('custom-furniture','Made for you','Custom beds','custom-beds','Sized to the room and mattress you own.','BedDouble',0),
    ('custom-furniture','Made for you','Custom wardrobes','custom-wardrobes','Built around how you actually pack things.','Archive',1),
    ('custom-furniture','Made for you','Custom tables','custom-tables','Any length, any top, any timber the workshop holds.','Table2',2),
    ('custom-furniture','More','Custom desks','custom-desks','Cut to the bay, cable run and way you work.','Monitor',3)
)
INSERT INTO mega_menu_sections
  (nav_item_id, group_label, name, slug, description, icon, sort_order)
SELECT n.id, s.group_label, s.name, s.slug, s.description, s.icon, s.sort_order
  FROM sections s
  JOIN nav_items n ON n.slug = s.nav_slug
ON CONFLICT (nav_item_id, slug) DO NOTHING;
-- Agati Furniture — seed data (PostgreSQL)
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
  (1, 'Living Room',  'living-room',  'Sofas, coffee tables and TV units built for the way you actually sit.', 'Sofa',   1, TRUE),
  (2, 'Bedroom',      'bedroom',      'Beds, wardrobes, bedside tables and dressing tables.',                'Bed',    2, TRUE),
  (3, 'Office',       'office',       'Desks, office chairs, bookcases and filing units.',                    'Table',  3, TRUE),
  (4, 'Dining Room',  'dining-room',  'Dining tables, dining chairs, sideboards and buffets.',                'UtensilsCrossed', 4, TRUE),
  (5, 'Kitchen',      'kitchen',      'Kitchen cabinets, islands, shelving and storage units.',                 'CookingPot', 5, TRUE),
  (6, 'Outdoor',      'outdoor',      'Garden furniture, patio sets and outdoor storage.',                     'TreePalm', 6, TRUE),
  (7, 'Chairs & Seating', 'chairs-seating', 'Office chairs, dining chairs, bar stools and lounge seating.',   'Armchair', 7, TRUE),
  (8, 'Storage & Shelving', 'storage-shelving', 'Wardrobes, bookshelves, shoe racks and modular storage.',   'Boxes', 8, TRUE),
  (9, 'Kids & Nursery', 'kids-nursery', 'Kids beds, study desks, toy storage and nursery furniture.',          'Baby', 9, TRUE),
  (10, 'Custom Furniture', 'custom-furniture', 'Made-to-measure pieces, built after a site visit or a drawing.', 'Hammer', 10, TRUE);

-- One category-bar entry per category. has_mega_menu = TRUE opens the panel with
-- its sections and pictures. The slug must match categories.slug: the
-- storefront joins the two tables on the slug, not on the id, because the two
-- id sequences are allowed to drift apart.
INSERT INTO nav_items (id, navbar, label, slug, description, icon, has_mega_menu, sort_order, is_active) VALUES
  (1, 'category_bar', 'Living Room', 'living-room',  'Sofas, coffee tables and TV units.', 'Sofa', TRUE, 1, TRUE),
  (2, 'category_bar', 'Bedroom',     'bedroom',      'Beds, wardrobes and bedside tables.', 'Bed', TRUE, 2, TRUE),
  (3, 'category_bar', 'Office',      'office',       'Desks, office chairs and bookcases.', 'Table', TRUE, 3, TRUE),
  (4, 'category_bar', 'Dining Room', 'dining-room',  'Dining tables, chairs and sideboards.', 'UtensilsCrossed', TRUE, 4, TRUE),
  (5, 'category_bar', 'Kitchen',     'kitchen',      'Kitchen cabinets, islands and shelving.', 'CookingPot', TRUE, 5, TRUE),
  (6, 'category_bar', 'Outdoor',     'outdoor',      'Garden furniture and patio sets.', 'TreePalm', TRUE, 6, TRUE),
  (7, 'category_bar', 'Chairs & Seating', 'chairs-seating', 'Office, dining and lounge chairs.', 'Armchair', TRUE, 7, TRUE),
  (8, 'category_bar', 'Storage & Shelving', 'storage-shelving', 'Wardrobes, shelves and storage.', 'Boxes', TRUE, 8, TRUE),
  (9, 'category_bar', 'Kids & Nursery', 'kids-nursery', 'Kids beds, study desks and toy storage.', 'Baby', TRUE, 9, TRUE),
  (10, 'category_bar', 'Custom Furniture', 'custom-furniture', 'Made to measure, quoted per project.', 'Hammer', TRUE, 10, TRUE),
  (11, 'top_bar', 'Home', 'home', 'Back to the home page.', 'House', FALSE, 1, TRUE),
  (12, 'top_bar', 'Custom Furniture', 'top-custom-furniture', 'Made-to-measure pieces.', 'Hammer', FALSE, 2, TRUE),
  (13, 'top_bar', 'Contact us', 'contact-us', 'Talk to the workshop.', 'Phone', FALSE, 3, TRUE);

-- The "Shop by type" groups shown inside each panel.
INSERT INTO mega_menu_sections (nav_item_id, group_label, name, slug, description, icon, sort_order, is_active) VALUES
  (1, 'Shop by type', 'Sofas & Sectionals', 'living-room-sofas', 'Three-seat, two-seat and chaise.', 'Sofa', 1, TRUE),
  (1, 'Shop by type', 'Coffee Tables', 'living-room-coffee-tables', 'Wood, glass and marble tops.', 'Table', 2, TRUE),
  (1, 'Shop by type', 'TV Units', 'living-room-tv-units', 'Lowboards and wall units.', 'Tv', 3, TRUE),
  (2, 'Shop by type', 'Beds & Bed Frames', 'bedroom-beds', 'Single, double, queen and king.', 'Bed', 1, TRUE),
  (2, 'Shop by type', 'Wardrobes', 'bedroom-wardrobes', 'Sliding and hinged.', 'DoorClosed', 2, TRUE),
  (2, 'Shop by type', 'Bedside Tables', 'bedroom-bedside-tables', 'With and without drawers.', 'Table', 3, TRUE),
  (3, 'Shop by type', 'Desks', 'office-desks', 'Standing and fixed height.', 'Table', 1, TRUE),
  (3, 'Shop by type', 'Office Chairs', 'office-chairs', 'Executive and mesh-back.', 'Armchair', 2, TRUE),
  (3, 'Shop by type', 'Bookcases', 'office-bookcases', 'Open shelving and closed units.', 'BookOpen', 3, TRUE),
  (4, 'Shop by type', 'Dining Tables', 'dining-tables', 'Seats four to ten.', 'Utensils', 1, TRUE),
  (4, 'Shop by type', 'Dining Chairs', 'dining-chairs', 'Solid, upholstered and stackable.', 'Armchair', 2, TRUE),
  (4, 'Shop by type', 'Sideboards', 'dining-sideboards', 'Buffets and servers.', 'Boxes', 3, TRUE),
  (5, 'Shop by type', 'Cabinets', 'kitchen-cabinets', 'Base and wall units.', 'CookingPot', 1, TRUE),
  (5, 'Shop by type', 'Kitchen Islands', 'kitchen-islands', 'With seating overhang.', 'CookingPot', 2, TRUE),
  (5, 'Shop by type', 'Shelving', 'kitchen-shelving', 'Open racks and cupboards.', 'Boxes', 3, TRUE),
  (6, 'Shop by type', 'Garden Sets', 'outdoor-sets', 'Four to eight seater.', 'TreePalm', 1, TRUE),
  (6, 'Shop by type', 'Patio Tables', 'outdoor-tables', 'Teak and all-weather.', 'Table', 2, TRUE),
  (7, 'Shop by type', 'Office Chairs', 'chairs-office', 'Ergonomic and executive.', 'Armchair', 1, TRUE),
  (7, 'Shop by type', 'Dining Chairs', 'chairs-dining', 'Solid and upholstered.', 'Armchair', 2, TRUE),
  (8, 'Shop by type', 'Wardrobes', 'storage-wardrobes', 'Hinged and sliding.', 'DoorClosed', 1, TRUE),
  (8, 'Shop by type', 'Bookshelves', 'storage-bookshelves', 'Wall and free standing.', 'BookOpen', 2, TRUE),
  (9, 'Shop by type', 'Kids Beds', 'kids-beds', 'Bunk, single and toddler.', 'Bed', 1, TRUE),
  (9, 'Shop by type', 'Study Desks', 'kids-study-desks', 'Height adjustable.', 'Table', 2, TRUE),
  (10, 'Shop by type', 'Custom Sofas', 'custom-sofas', 'Built to your measurements.', 'Sofa', 1, TRUE),
  (10, 'Shop by type', 'Custom Tables', 'custom-tables', 'Any size, any timber.', 'Hammer', 2, TRUE);

-- Roles and permissions: the same fifteen permissions and four roles the
-- Next.js admin uses, so a role means the same thing on both stacks.
INSERT INTO permissions (key, description) VALUES
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
   WHERE key IN ('dashboard.view','products.view','products.edit','orders.view','orders.edit',
                 'customers.view','customers.edit','quotes.view','quotes.edit','content.edit',
                 'media.edit','reports.view');

INSERT INTO role_permissions (role_id, permission_id)
  SELECT 3, id FROM permissions
   WHERE key IN ('dashboard.view','products.view','content.edit','media.edit');

INSERT INTO role_permissions (role_id, permission_id)
  SELECT 4, id FROM permissions
   WHERE key IN ('dashboard.view','products.view','orders.view','orders.edit',
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
  ('Made in Uganda', 'Solid timber furniture, built to order in our workshop.', 1, TRUE),
  ('Custom pieces', 'Send us your measurements and we will quote it.', 2, TRUE);

INSERT INTO pages (title, slug, body, is_published) VALUES
  ('About Agati Furniture', 'about', 'Agati Furniture is a workshop in Uganda making solid timber furniture: sofas, beds, dining sets, office desks and made-to-measure pieces.', TRUE);

INSERT INTO announcements (title, body, is_active) VALUES
  ('Free delivery within Kampala', 'On orders over UGX 500,000.', TRUE);

-- Move the sequences past the explicit ids used above.
--
-- PostgreSQL sequences do not notice that rows were inserted with an explicit
-- id: SERIAL only advances on an insert that leaves the id to the database. So
-- without this, the first category created through the admin would be handed
-- id 1 and fail with a duplicate key. MySQL sets AUTO_INCREMENT from the
-- highest id actually inserted, which is why this file needs no equivalent.
-- Wrapped in a DO block so setval does not print a result row on every import.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'categories', 'nav_items', 'mega_menu_sections', 'roles', 'permissions'
  ] LOOP
    EXECUTE format(
      'SELECT setval(%L, (SELECT MAX(id) FROM %I))',
      pg_get_serial_sequence(t, 'id'), t
    );
  END LOOP;
END $$;
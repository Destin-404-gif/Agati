-- The 10-department taxonomy the storefront and navigation read from.
--
-- This file previously also created `category_images`, the table behind the
-- per-department hero / menu / banner imagery manager. That feature has been
-- removed, so the table is dropped here. Keeping the DROP in a migration means a
-- fresh database and an existing one converge on the same schema instead of
-- leaving an orphaned table behind.
DROP TABLE IF EXISTS category_images;

-- Backs the composite lookups the category pages make against subcategories.
CREATE UNIQUE INDEX IF NOT EXISTS idx_subcategories_category_id_id
  ON subcategories (category_id, id);

-- Ensure the requested department tree exists even when the original taxonomy
-- seed was not run before this migration.
INSERT INTO categories (name, slug, description, icon, sort_order, is_active)
VALUES
  ('Living Room','living-room','Sofas, armchairs and coffee tables for the rooms we live in.','Sofa',0,TRUE),
  ('Bedroom','bedroom','Beds, wardrobes and bedside furniture made for rest.','BedDouble',1,TRUE),
  ('Office','office','Desks, chairs and storage for focused work.','Briefcase',2,TRUE),
  ('Dining Room','dining-room','Tables and seating for everyday meals and gatherings.','UtensilsCrossed',3,TRUE),
  ('Kitchen','kitchen','Cabinetry, islands and useful kitchen furniture.','ChefHat',4,TRUE),
  ('Outdoor','outdoor','Garden and patio furniture built for the elements.','TreePine',5,TRUE),
  ('Chairs & Seating','chairs-seating','Chairs, stools and benches for every room.','Armchair',6,TRUE),
  ('Storage & Shelving','storage-shelving','Cabinets, shelves and considered storage.','Library',7,TRUE),
  ('Kids & Nursery','kids-nursery','Beds, study furniture and storage for children.','Baby',8,TRUE),
  ('Custom Furniture','custom-furniture','Made-to-measure furniture designed for your space.','Ruler',9,TRUE)
ON CONFLICT (slug) DO NOTHING;
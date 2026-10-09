-- Make the categories table the source of truth for the public category bar.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS icon VARCHAR(80) NOT NULL DEFAULT 'Package';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE subcategories ADD COLUMN IF NOT EXISTS icon VARCHAR(80) NOT NULL DEFAULT 'Package';

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
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_active = TRUE;

WITH section_seed(category_slug, name, slug, icon, position) AS (
  VALUES
    ('living-room','Sofas','sofas','Sofa',0),
    ('living-room','Armchairs','armchairs','Armchair',1),
    ('living-room','Coffee tables','coffee-tables','Table',2),
    ('living-room','TV stands','tv-stands','Tv',3),
    ('bedroom','Beds & frames','beds-bed-frames','BedDouble',0),
    ('bedroom','Wardrobes','wardrobes','Archive',1),
    ('bedroom','Bedside tables','bedside-tables','Lamp',2),
    ('bedroom','Dressing tables','dressing-tables','LampDesk',3),
    ('office','Office desks','office-desks','Table',0),
    ('office','Office chairs','office-chairs','Armchair',1),
    ('office','Meeting tables','meeting-tables','Table2',2),
    ('office','Filing cabinets','filing-cabinets','Boxes',3),
    ('dining-room','Dining tables','dining-tables','Table2',0),
    ('dining-room','Dining chairs','dining-chairs','Armchair',1),
    ('dining-room','Sideboards & buffets','sideboards-buffets','PanelLeft',2),
    ('dining-room','Bar stools','bar-stools','Shapes',3),
    ('kitchen','Kitchen cabinets','kitchen-cabinets','ChefHat',0),
    ('kitchen','Islands','kitchen-islands','Cuboid',1),
    ('kitchen','Pantry storage','pantry-storage','Boxes',2),
    ('outdoor','Outdoor tables','outdoor-tables','Table2',0),
    ('outdoor','Outdoor chairs','outdoor-chairs','Armchair',1),
    ('outdoor','Garden benches','garden-benches','Trees',2),
    ('chairs-seating','Armchairs','armchairs','Armchair',0),
    ('chairs-seating','Dining chairs','dining-chairs','Armchair',1),
    ('chairs-seating','Office chairs','office-chairs','Armchair',2),
    ('chairs-seating','Bar stools','bar-stools','Shapes',3),
    ('storage-shelving','Cabinets','cabinets','Archive',0),
    ('storage-shelving','Bookshelves','bookshelves','BookOpen',1),
    ('storage-shelving','Shelving units','shelving-units','Rows3',2),
    ('kids-nursery','Children''s beds','childrens-beds','Bed',0),
    ('kids-nursery','Bunk beds','bunk-beds','BedSingle',1),
    ('kids-nursery','Study desks','study-desks','Monitor',2),
    ('kids-nursery','Toy storage','toy-storage','Package',3),
    ('custom-furniture','Custom beds','custom-beds','BedDouble',0),
    ('custom-furniture','Custom wardrobes','custom-wardrobes','Archive',1),
    ('custom-furniture','Custom tables','custom-tables','Table2',2),
    ('custom-furniture','Custom desks','custom-desks','Monitor',3)
)
INSERT INTO subcategories (category_id, name, slug, icon, position)
SELECT c.id, seed.name, seed.slug, seed.icon, seed.position
  FROM section_seed seed
  JOIN categories c ON c.slug = seed.category_slug
ON CONFLICT (category_id, slug) DO UPDATE SET
  name = EXCLUDED.name,
  icon = EXCLUDED.icon,
  position = EXCLUDED.position;

-- Move products out of the old coarse category rows before hiding those rows.
UPDATE products p
   SET category_id = target.id,
       subcategory_id = CASE
         WHEN lower(old.slug) = 'armchairs' THEN (
           SELECT s.id FROM subcategories s WHERE s.category_id = target.id AND s.slug = 'armchairs'
         )
         WHEN lower(old.slug) = 'chairs' AND lower(p.name) LIKE '%dining%' THEN (
           SELECT s.id FROM subcategories s JOIN categories cc ON cc.id = s.category_id
            WHERE cc.slug = 'chairs-seating' AND s.slug = 'dining-chairs'
         )
         WHEN lower(old.slug) = 'chairs' AND lower(p.name) LIKE '%stool%' THEN (
           SELECT s.id FROM subcategories s JOIN categories cc ON cc.id = s.category_id
            WHERE cc.slug = 'chairs-seating' AND s.slug = 'bar-stools'
         )
         WHEN lower(old.slug) IN ('sofas','sofa') AND lower(p.name) ~ '(sofa|couch|chaise|sectional)' THEN (
           SELECT s.id FROM subcategories s WHERE s.category_id = target.id AND s.slug = 'sofas'
         )
         WHEN lower(old.slug) IN ('dinning','dining') AND lower(p.name) LIKE '%chair%' THEN (
           SELECT s.id FROM subcategories s WHERE s.category_id = target.id AND s.slug = 'dining-chairs'
         )
         WHEN lower(old.slug) IN ('dinning','dining') AND lower(p.name) LIKE '%table%' THEN (
           SELECT s.id FROM subcategories s WHERE s.category_id = target.id AND s.slug = 'dining-tables'
         )
         ELSE NULL
       END
  FROM categories old,
       categories target
 WHERE p.category_id = old.id
   AND (
     (lower(old.slug) = 'armchairs' AND target.slug = 'chairs-seating') OR
     (lower(old.slug) = 'chairs' AND target.slug = 'chairs-seating') OR
     (lower(old.slug) IN ('sofas','sofa') AND target.slug = 'living-room') OR
     (lower(old.slug) IN ('dinning','dining') AND target.slug = 'dining-room')
   );

UPDATE categories
   SET is_active = FALSE
 WHERE slug NOT IN (
   'living-room','bedroom','office','dining-room','kitchen','outdoor',
   'chairs-seating','storage-shelving','kids-nursery','custom-furniture'
 );

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory_id);
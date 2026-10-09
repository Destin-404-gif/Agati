-- Agati Furniture — sample data (wood / Scandinavian furniture theme)
-- Run AFTER db/schema.sql:  psql "$DATABASE_URL" -f db/seed.sql

TRUNCATE quote_requests, order_items, orders, cart_items, product_variants, product_images, products, categories, users RESTART IDENTITY CASCADE;
-- ---------------------------------------------------------------- categories
INSERT INTO categories (id, name, slug, image_url) VALUES
  (1, 'Armchairs', 'armchairs', '/images/722c409355ea1b257fcffac9ad74c45f.jpg'),
  (2, 'Chairs',    'chairs',    '/images/722594337cd0404894960da95bac0c85.jpg'),
  (3, 'Sofas',     'sofas',     '/images/8bbe890a02dc3d74a06923a90119d470.jpg');

SELECT setval(pg_get_serial_sequence('categories', 'id'), (SELECT MAX(id) FROM categories));

-- ------------------------------------------------------------------ products
-- is_custom marks the made-to-measure pieces: no list price, so the storefront
-- offers a quote instead of an Add to Cart button.
INSERT INTO products
  (id, name, slug, sku, description, price, category_id, is_new, is_featured, is_custom, stock_quantity)
VALUES
  (1, 'Halden Lounge Chair', 'halden-lounge-chair', 'AGW-ARC-1001',
   'A low-slung oak frame cradling a hand-stuffed wool seat. Shaped over four seasons of workshop trials, the Halden holds a conversation the way good furniture holds a room.',
   1290.00, 1, TRUE,  TRUE,  FALSE, 14),
  (2, 'Fjord Accent Chair', 'fjord-accent-chair', 'AGW-ARC-1002',
   'Solids from a single felled trunk, steam-bent into one continuous curve. No visible joinery, no compromise.',
   640.00, 1, FALSE, TRUE,  FALSE, 22),
  (3, 'Moss Reading Chair', 'moss-reading-chair', 'AGW-ARC-1003',
   'Deep buttoned back, feather-wrapped foam core, and a walnut footrest that arrives separately.',
   1120.00, 1, TRUE,  FALSE, FALSE, 9),
  (4, 'Birch Dining Chair', 'birch-dining-chair', 'AGW-CHN-1004',
   'The workhorse of the collection. Steam-bent beech, woven paper-cord seat, finished with a hardwax oil you can repair at home.',
   395.00, 2, FALSE, TRUE,  FALSE, 48),
  (5, 'Soren Side Chair', 'soren-side-chair', 'AGW-CHN-1005',
   'Light enough to move with one hand, sturdy enough to stay put for thirty years. Available in four oiled finishes.',
   470.00, 2, FALSE, FALSE, FALSE, 36),
  (6, 'Linden Counter Stool', 'linden-counter-stool', 'AGW-CHN-1006',
   'Tall, quiet, and honest. A footrest forged from a single length of flat bar, set flush into the legs.',
   340.00, 2, TRUE,  FALSE, FALSE, 27),
  (7, 'Terra Modular Sofa', 'terra-modular-sofa', 'AGW-SOF-1007',
   'Three modules, six arrangements, one silhouette. Feather-blend cushions over a kiln-dried beagle frame.',
   3480.00, 3, FALSE, TRUE,  FALSE, 7),
  (8, 'Alder Two-Seater', 'alder-two-seater', 'AGW-SOF-1008',
   'Compact proportions for apartments and long dinners. Removable covers, foam-free cushioning.',
   2190.00, 3, FALSE, FALSE, FALSE, 11),
  (9, 'Dune Chaise Sectional', 'dune-chaise-sectional', 'AGW-SOF-1009',
   'An L-shape built for lying down. Oak plinth, feather wrap, and a chaise long enough to actually stretch out. Made to measure, so it is priced per commission.',
   4750.00, 3, TRUE,  TRUE,  TRUE,  4);

SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT MAX(id) FROM products));

-- ------------------------------------------------------------ product_images
INSERT INTO product_images (product_id, image_url, position) VALUES
  (1, '/images/722c409355ea1b257fcffac9ad74c45f.jpg', 0),
  (1, '/images/722594337cd0404894960da95bac0c85.jpg', 1),
  (1, '/images/6810cafab629f718fa1b3fcbecc73894.jpg', 2),
  (2, '/images/32f5312120115c193648b5d87b0c2d5e.jpg', 0),
  (2, '/images/8bbe890a02dc3d74a06923a90119d470.jpg', 1),
  (3, '/images/a3275c39eebc7f96ff8e4d0068396c2e.jpg', 0),
  (3, '/images/58cec0fa0b8e9419b71ee79748d02435.jpg', 1),
  (4, '/images/ca52cd588e9675652905324b50a76cdc.jpg', 0),
  (4, '/images/4bd99f974839ce2291700c66e7e125de.jpg', 1),
  (5, '/images/722c409355ea1b257fcffac9ad74c45f.jpg', 0),
  (6, '/images/722594337cd0404894960da95bac0c85.jpg', 0),
  (6, '/images/6810cafab629f718fa1b3fcbecc73894.jpg', 1),
  (7, '/images/32f5312120115c193648b5d87b0c2d5e.jpg', 0),
  (7, '/images/8bbe890a02dc3d74a06923a90119d470.jpg', 1),
  (7, '/images/a3275c39eebc7f96ff8e4d0068396c2e.jpg', 2),
  (8, '/images/58cec0fa0b8e9419b71ee79748d02435.jpg', 0),
  (8, '/images/ca52cd588e9675652905324b50a76cdc.jpg', 1),
  (9, '/images/4bd99f974839ce2291700c66e7e125de.jpg', 0),
  (9, '/images/722c409355ea1b257fcffac9ad74c45f.jpg', 1);

-- ---------------------------------------------------------- product_variants
-- A colourway reuses its own product's front photo (see src/lib/images.ts).
INSERT INTO product_variants (product_id, variant_name, color, price_modifier, image_url) VALUES
  (1, 'Halden 01', 'Sage Bouclé',     0.00,   '/images/722c409355ea1b257fcffac9ad74c45f.jpg'),
  (1, 'Halden 02', 'Cream Linen',     0.00,   '/images/722c409355ea1b257fcffac9ad74c45f.jpg'),
  (1, 'Halden 03', 'Terracotta Wool', 120.00, '/images/722c409355ea1b257fcffac9ad74c45f.jpg'),
  (2, 'Fjord Oak',    'Natural Oak',    0.00,   '/images/32f5312120115c193648b5d87b0c2d5e.jpg'),
  (2, 'Fjord Smoked', 'Smoked Oak',     90.00,  '/images/32f5312120115c193648b5d87b0c2d5e.jpg'),
  (4, 'Birch 01', 'Natural Beech',   0.00,   '/images/ca52cd588e9675652905324b50a76cdc.jpg'),
  (4, 'Birch 02', 'Walnut',         60.00,  '/images/ca52cd588e9675652905324b50a76cdc.jpg'),
  (4, 'Birch 03', 'Black Ash',       60.00,  '/images/ca52cd588e9675652905324b50a76cdc.jpg'),
  (7, 'Terra 3-Seat', 'Sage Wool',      0.00,   '/images/32f5312120115c193648b5d87b0c2d5e.jpg'),
  (7, 'Terra 4-Seat', 'Sage Wool',      640.00, '/images/32f5312120115c193648b5d87b0c2d5e.jpg'),
  (7, 'Terra Corner',  'Cream Bouclé',  520.00, '/images/32f5312120115c193648b5d87b0c2d5e.jpg'),
  (9, 'Dune Chaise', 'Terracotta',    0.00,   '/images/4bd99f974839ce2291700c66e7e125de.jpg'),
  (9, 'Dune Chaise XL', 'Terracotta',  780.00, '/images/4bd99f974839ce2291700c66e7e125de.jpg');

-- ------------------------------------------------------- demo user + cart
INSERT INTO users (id, email, password_hash, full_name) VALUES
  (1, 'demo@agati.store', 'not-a-real-hash-demo-only', 'Demo Customer');

SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users));

INSERT INTO cart_items (user_id, product_id, variant_id, quantity) VALUES
  (1, 1, 1, 1),
  (1, 4, 6, 2);

-- --------------------------------------------------- sample quote enquiries
INSERT INTO quote_requests (name, email, phone, project_type, budget, timeline, message, status) VALUES
  ('Marta Lindqvist', 'marta@example.com', '+45 30 12 34 56',
   'Dining table', '$2,000 – $8,000', '1–3 months',
   'Single 320cm white oak slab, 12 seats, we would like to keep the natural edge.', 'new'),
  ('Devon Harris', 'devon@example.com', NULL,
   'Wall library', '$8,000 – $25,000', '3–6 months',
   'Full wall unit in a 1930s flat, plaster is not square anywhere. Happy to share photos.', 'new'),
  ('Sofia Berg', 'sofia@example.com', '0781234567',
   'Restoration', 'Under $2,000', 'ASAP',
   'Grandmother''s oak dining table, one leg split and a loose mortise. Can it be saved?', 'replied');

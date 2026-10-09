-- 014 team nav item
-- Sits between Gallery and About in the storefront top bar. The renumbering
-- guards are idempotent: they only fire once, so the tombstones an admin drags
-- around later are never overwritten on re-run.
INSERT INTO nav_items (navbar, label, slug, icon, has_mega_menu, sort_order)
VALUES ('top_bar', 'Team', 'team', 'Users', FALSE, 5)
ON CONFLICT (slug) DO NOTHING;

UPDATE nav_items SET sort_order = 6
 WHERE navbar = 'top_bar' AND slug = 'about' AND sort_order = 5;

UPDATE nav_items SET sort_order = 7
 WHERE navbar = 'top_bar' AND slug = 'contact' AND sort_order = 6;
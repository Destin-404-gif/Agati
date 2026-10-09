-- Images shown in the empty right-hand column of each category mega menu.
--
-- The storefront reads these by category_id, which is `categories.id` -- the same
-- row the category bar in the navbar is built from, so "the Bedroom menu" and
-- "the Bedroom category" are the same thing and cannot drift apart.
--
-- The file itself lives in `media_uploads` (written by the shared upload
-- pipeline, served from /uploads by the catch-all route). `image_path` stores the
-- canonical, largest variant url; the 400/1200/2560 family is read back by
-- joining `media_uploads` on that url, exactly as the gallery does, so a
-- responsive `srcSet` needs no extra columns here.
--
-- At most three rows per category is enforced by the API (`MENU_IMAGES_PER_
-- CATEGORY`) rather than by a unique constraint: reorder rewrites sort_order row
-- by row, and a unique index on (category_id, sort_order) would make the
-- intermediate states of a swap fail.

CREATE TABLE IF NOT EXISTS menu_images (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  image_path TEXT NOT NULL,
  -- Optional line under the picture on the storefront, and the alt text when the
  -- admin has not written a dedicated one.
  caption VARCHAR(200),
  -- Where the picture goes. A site-relative path ('/shop/sofas') or a full
  -- http(s) address; anything else is refused on write, so the storefront can
  -- never render a `javascript:` href.
  link_url VARCHAR(500),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- The only read pattern: every active category's images, in display order.
CREATE INDEX IF NOT EXISTS idx_menu_images_category
  ON menu_images (category_id, sort_order, id);
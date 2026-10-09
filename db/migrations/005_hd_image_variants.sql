-- 005 — high-definition image variants.
--
-- Additive and idempotent: safe to run against a populated database, and it keeps
-- every existing row. The upload pipeline now writes a 400 / 1200 / 2560 / 3840
-- family from a private original and records the urls, the source dimensions and
-- the file size here.
--
--   psql "$DATABASE_URL" -f db/migrations/005_hd_image_variants.sql
--
-- db/admin-schema.sql and db/schema.sql already declare these columns, so a fresh
-- `npm run db:setup` / `npm run db:admin` does not need this file.

-- ---------- media_uploads: the library's source of truth ----------
ALTER TABLE media_uploads ADD COLUMN IF NOT EXISTS variant_400_url  TEXT;
ALTER TABLE media_uploads ADD COLUMN IF NOT EXISTS variant_1200_url TEXT;
ALTER TABLE media_uploads ADD COLUMN IF NOT EXISTS variant_2560_url TEXT;
ALTER TABLE media_uploads ADD COLUMN IF NOT EXISTS variant_3840_url TEXT;
ALTER TABLE media_uploads ADD COLUMN IF NOT EXISTS original_width  INTEGER;
ALTER TABLE media_uploads ADD COLUMN IF NOT EXISTS original_height INTEGER;
ALTER TABLE media_uploads ADD COLUMN IF NOT EXISTS original_path   TEXT;
ALTER TABLE media_uploads ADD COLUMN IF NOT EXISTS quality         VARCHAR(10);

-- ---------- media_slots: a slot copies the variant urls when it is assigned ----------
ALTER TABLE media_slots ADD COLUMN IF NOT EXISTS variant_400_url  TEXT;
ALTER TABLE media_slots ADD COLUMN IF NOT EXISTS variant_1200_url TEXT;
ALTER TABLE media_slots ADD COLUMN IF NOT EXISTS variant_2560_url TEXT;
ALTER TABLE media_slots ADD COLUMN IF NOT EXISTS variant_3840_url TEXT;
ALTER TABLE media_slots ADD COLUMN IF NOT EXISTS original_width  INTEGER;
ALTER TABLE media_slots ADD COLUMN IF NOT EXISTS original_height INTEGER;

-- ---------- gallery_items: the public gallery reads these directly ----------
ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS variant_400_url  TEXT;
ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS variant_1200_url TEXT;
ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS variant_2560_url TEXT;
ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS variant_3840_url TEXT;
ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS image_width     INTEGER;
ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS image_height    INTEGER;
ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS image_bytes     INTEGER;
ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS original_width  INTEGER;
ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS original_height INTEGER;
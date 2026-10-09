-- Agati admin: auth, roles, audit, settings, content
-- Additive only. Does not alter or drop any existing table/data.
-- Safe to run repeatedly (all statements are idempotent).

-- ---------- roles & permissions ----------
CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(60) UNIQUE NOT NULL,
  slug        VARCHAR(60) UNIQUE NOT NULL,
  description TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS permissions (
  id          SERIAL PRIMARY KEY,
  key         VARCHAR(80) UNIQUE NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ---------- staff (separate from public `users` table) ----------
-- `username` is the human-facing login handle; `email` stays unique and is
-- still accepted by the login form, so either one works.
-- `status` is the source of truth for account state. `is_active` predates it and
-- is kept in sync by the trigger below so the existing call sites stay correct.
CREATE TABLE IF NOT EXISTS staff_users (
  id            SERIAL PRIMARY KEY,
  email         VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name     VARCHAR(150),
  role_id       INTEGER REFERENCES roles(id) ON DELETE SET NULL,
  is_active     BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP,
  created_at    TIMESTAMP DEFAULT NOW()
);

ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS username VARCHAR(60);
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Retired with the forced-password-change flow. A fresh install never creates
-- them; `db/migrations/003_fixed_admin_password.sql` drops them on an existing
-- database. Accounts and their password hashes are not touched.
ALTER TABLE staff_users DROP COLUMN IF EXISTS must_change_password;
ALTER TABLE staff_users DROP COLUMN IF EXISTS password_changed_at;
ALTER TABLE staff_users DROP COLUMN IF EXISTS password_expires_at;

-- Backfill a handle for accounts created before usernames existed: the local
-- part of the email address, sanitised to [a-z0-9._-].
UPDATE staff_users
   SET username = LOWER(REGEXP_REPLACE(SPLIT_PART(email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g'))
 WHERE username IS NULL OR username = '';

-- The derivation trigger below fills this in, so it can be tightened once every
-- existing row has been backfilled.
ALTER TABLE staff_users ALTER COLUMN username SET NOT NULL;

-- Only the three states the admin UI offers are representable. Without this a
-- typo in an UPDATE would silently lock somebody out of every login path.
ALTER TABLE staff_users DROP CONSTRAINT IF EXISTS staff_users_status_check;
ALTER TABLE staff_users
  ADD CONSTRAINT staff_users_status_check
  CHECK (status IN ('active', 'suspended', 'invited'));

-- Usernames are unique, but only case-insensitively — "Agnes" and "agnes" must
-- not both be creatable. A plain UNIQUE index would allow that.
CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_users_username
  ON staff_users (LOWER(username));

-- Keep the legacy boolean mirroring `status`.
CREATE OR REPLACE FUNCTION staff_sync_is_active() RETURNS trigger AS $$
BEGIN
  NEW.is_active := (NEW.status = 'active');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staff_sync_is_active ON staff_users;
CREATE TRIGGER trg_staff_sync_is_active
  BEFORE INSERT OR UPDATE OF status ON staff_users
  FOR EACH ROW EXECUTE FUNCTION staff_sync_is_active();

-- Derive a login handle when the caller did not supply one, and normalise
-- whatever they did supply. Runs before the NOT NULL check.
CREATE OR REPLACE FUNCTION staff_require_username() RETURNS trigger AS $$
BEGIN
  IF NEW.username IS NULL OR NEW.username = '' THEN
    NEW.username := LOWER(REGEXP_REPLACE(SPLIT_PART(NEW.email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g'));
  ELSE
    NEW.username := LOWER(TRIM(NEW.username));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staff_require_username ON staff_users;
CREATE TRIGGER trg_staff_require_username
  BEFORE INSERT OR UPDATE OF username, email ON staff_users
  FOR EACH ROW EXECUTE FUNCTION staff_require_username();

CREATE TABLE IF NOT EXISTS sessions (
  id         SERIAL PRIMARY KEY,
  staff_id   INTEGER NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  user_agent TEXT,
  ip         VARCHAR(64),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_staff    ON sessions(staff_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires  ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS password_resets (
  id         SERIAL PRIMARY KEY,
  staff_id   INTEGER NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at    TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_resets_staff ON password_resets(staff_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(255),
  ip         VARCHAR(64),
  success    BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup ON login_attempts(email, created_at DESC);

-- ---------- audit ----------
CREATE TABLE IF NOT EXISTS audit_logs (
  id          SERIAL PRIMARY KEY,
  staff_id    INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  staff_email VARCHAR(255),
  action      VARCHAR(40) NOT NULL,
  entity      VARCHAR(60),
  entity_id   VARCHAR(60),
  before_data JSONB,
  after_data  JSONB,
  ip          VARCHAR(64),
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity  ON audit_logs(entity, entity_id);

-- ---------- settings ----------
CREATE TABLE IF NOT EXISTS settings (
  key        VARCHAR(80) PRIMARY KEY,
  value      JSONB,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR(255)
);

-- ---------- media library ----------
-- Every image on the public site is one row here, addressed by a stable slot key
-- (`hero_slide_1`, `page_hero_about`, `logo`, …). The storefront reads only from
-- this table, so replacing a picture is a database update and shows up on the
-- next request — no rebuild, no deploy.
--
-- A slot with `image_url IS NULL` is not an error: the storefront renders a
-- neutral placeholder for it until an admin uploads something.
CREATE TABLE IF NOT EXISTS media_slots (
  slot_key   VARCHAR(80) PRIMARY KEY,
  label      VARCHAR(120) NOT NULL,
  group_name VARCHAR(60) NOT NULL DEFAULT 'general',
  kind       VARCHAR(20) NOT NULL DEFAULT 'photo',
  image_url  TEXT,
  thumb_url  TEXT,
  variant_400_url  TEXT,
  variant_1200_url TEXT,
  variant_2560_url TEXT,
  variant_3840_url TEXT,
  alt_text   VARCHAR(300),
  width      INTEGER,
  height     INTEGER,
  bytes      INTEGER,
  original_width  INTEGER,
  original_height INTEGER,
  position   INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_media_slots_group ON media_slots(group_name, position);

-- Every file the admin has ever uploaded, whether or not it is still assigned to
-- a slot. Keeping the files lets an admin re-assign or roll back an image
-- without uploading it again.
CREATE TABLE IF NOT EXISTS media_uploads (
  id            SERIAL PRIMARY KEY,
  filename      VARCHAR(255) NOT NULL,
  url           TEXT NOT NULL,
  thumb_url     TEXT,
  variant_400_url  TEXT,
  variant_1200_url TEXT,
  variant_2560_url TEXT,
  variant_3840_url TEXT,
  original_name VARCHAR(255),
  mime          VARCHAR(40),
  alt_text      VARCHAR(300),
  bytes         INTEGER,
  width         INTEGER,
  height        INTEGER,
  original_width  INTEGER,
  original_height INTEGER,
  original_path   TEXT,
  quality         VARCHAR(10),
  created_at    TIMESTAMP DEFAULT NOW(),
  created_by    VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_media_uploads_created ON media_uploads(created_at DESC);

-- ---------- content management ----------
CREATE TABLE IF NOT EXISTS banners (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(150) NOT NULL,
  subtitle   TEXT,
  image_url  TEXT,
  link_url   TEXT,
  position   INTEGER DEFAULT 0,
  is_active  BOOLEAN DEFAULT TRUE,
  starts_at  TIMESTAMP,
  ends_at    TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pages (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(150) NOT NULL,
  slug       VARCHAR(150) UNIQUE NOT NULL,
  body       TEXT,
  is_published BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id         SERIAL PRIMARY KEY,
  title      VARCHAR(150) NOT NULL,
  body       TEXT,
  link_url   TEXT,
  is_active  BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quote_notes (
  id          SERIAL PRIMARY KEY,
  quote_id    INTEGER NOT NULL REFERENCES quote_requests(id) ON DELETE CASCADE,
  staff_id    INTEGER REFERENCES staff_users(id) ON DELETE SET NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_quote_notes_quote ON quote_notes(quote_id);

-- ---------- additive column for product status workflow ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'products' AND column_name = 'status') THEN
    ALTER TABLE products ADD COLUMN status VARCHAR(30) DEFAULT 'active';
  END IF;
END
$$;

-- ---------- additive notes column for orders ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'orders' AND column_name = 'notes') THEN
    ALTER TABLE orders ADD COLUMN notes TEXT;
  END IF;
END
$$;

-- =============================================================================
-- Section 5: one fixed admin password
--
-- Drops the columns that drove forced/rotated password behaviour. Existing
-- admin accounts and their password hashes are untouched: this only removes
-- bookkeeping that nothing reads any more.
--
-- Safe to run more than once.
-- =============================================================================

-- The forced first-login change flag. Login, the dashboard layout and the
-- change-password page no longer read it.
ALTER TABLE staff_users DROP COLUMN IF EXISTS must_change_password;

-- Password expiry / rotation bookkeeping.
ALTER TABLE staff_users DROP COLUMN IF EXISTS password_changed_at;
ALTER TABLE staff_users DROP COLUMN IF EXISTS password_expires_at;
ALTER TABLE staff_users DROP COLUMN IF EXISTS must_change_password_at;

-- Password history, if an earlier iteration of the change-password flow kept it.
-- `password_history` and `staff_password_history` are both plausible names for
-- it, so both are cleared defensively.
DROP TABLE IF EXISTS password_history;
DROP TABLE IF EXISTS staff_password_history;

-- `is_active` predates `status` and is kept in sync by a trigger, so it stays.

-- Record the shape this migration leaves behind.
COMMENT ON TABLE staff_users IS
  'Admin accounts. One fixed password per account: no forced change, no expiry, no history.';
-- 013 team members
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='team_role') THEN
    CREATE TYPE team_role AS ENUM ('owner','administrator','worker');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname='team_status') THEN
    CREATE TYPE team_status AS ENUM ('working','off_duty','on_leave');
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS team_members (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  role team_role NOT NULL DEFAULT 'worker',
  job_title VARCHAR(100),
  phone VARCHAR(32),
  email VARCHAR(255),
  photo_url TEXT,
  status team_status NOT NULL DEFAULT 'working',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_team_members_role ON team_members(role);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);
CREATE INDEX IF NOT EXISTS idx_team_members_sort_order ON team_members(sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_members_single_owner ON team_members((1)) WHERE role='owner';
CREATE OR REPLACE FUNCTION update_team_members_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at=CURRENT_TIMESTAMP; RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS team_members_updated_at ON team_members;
CREATE TRIGGER team_members_updated_at BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION update_team_members_updated_at();
INSERT INTO team_members (full_name,role,job_title,status,is_active,sort_order) SELECT 'Owner of Agati','owner','Founder','working',TRUE,0 WHERE NOT EXISTS (SELECT 1 FROM team_members WHERE role='owner');

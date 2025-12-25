/*
  # ic_positions tablosu

  Ünvanlar ve pozisyonları saklayan tablo
*/

CREATE TABLE IF NOT EXISTS ic_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ic_plan_id uuid NOT NULL REFERENCES ic_plans(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  level text NOT NULL CHECK (level IN ('üst_yönetim', 'orta_kademe', 'alt_kademe', 'operasyonel')),
  parent_position_id uuid REFERENCES ic_positions(id) ON DELETE SET NULL,
  responsibilities text,
  authorities text,
  qualifications text,
  reports_to text,
  supervises text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, ic_plan_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ic_positions_org_plan ON ic_positions(organization_id, ic_plan_id);
CREATE INDEX IF NOT EXISTS idx_ic_positions_parent ON ic_positions(parent_position_id);
CREATE INDEX IF NOT EXISTS idx_ic_positions_code ON ic_positions(organization_id, code);
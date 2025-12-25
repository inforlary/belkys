/*
  # ic_position_assignments tablosu

  Kullanıcıların pozisyon atamalarını saklayan tablo
*/

CREATE TABLE IF NOT EXISTS ic_position_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ic_plan_id uuid NOT NULL REFERENCES ic_plans(id) ON DELETE CASCADE,
  position_id uuid NOT NULL REFERENCES ic_positions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean DEFAULT true,
  assignment_type text NOT NULL DEFAULT 'asıl' CHECK (assignment_type IN ('asıl', 'vekil', 'geçici')),
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX IF NOT EXISTS idx_ic_position_assignments_org_plan ON ic_position_assignments(organization_id, ic_plan_id);
CREATE INDEX IF NOT EXISTS idx_ic_position_assignments_position ON ic_position_assignments(position_id);
CREATE INDEX IF NOT EXISTS idx_ic_position_assignments_user ON ic_position_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_ic_position_assignments_active ON ic_position_assignments(is_active) WHERE is_active = true;
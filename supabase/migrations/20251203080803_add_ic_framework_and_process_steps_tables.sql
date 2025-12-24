/*
  # Add IC Framework and Process Steps Tables

  Creates missing tables:
  - ic_process_steps - Process step details
  - ic_raci_matrix - RACI responsibility matrix
  - ic_sod_rules - Segregation of Duties rules
  - ic_ethics_commitments - Ethics commitments tracking
*/

-- SÜREÇ ADIMLARI
CREATE TABLE IF NOT EXISTS ic_process_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES ic_processes(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  step_name text NOT NULL,
  step_description text,
  responsible_role text,
  responsible_user_id uuid REFERENCES profiles(id),
  estimated_duration text,
  inputs text,
  outputs text,
  tools_used text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_process_steps_org ON ic_process_steps(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_process_steps_process ON ic_process_steps(process_id);

ALTER TABLE ic_process_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view process steps in their org"
  ON ic_process_steps FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Process owners can manage steps"
  ON ic_process_steps FOR ALL
  TO authenticated
  USING (
    process_id IN (
      SELECT id FROM ic_processes
      WHERE department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
      OR owner_user_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- RACI MATRİSİ
CREATE TABLE IF NOT EXISTS ic_raci_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  process_id uuid REFERENCES ic_processes(id),
  activity_name text NOT NULL,
  responsible_role text,
  responsible_user_id uuid REFERENCES profiles(id),
  accountable_role text,
  accountable_user_id uuid REFERENCES profiles(id),
  consulted_roles text[],
  consulted_user_ids uuid[],
  informed_roles text[],
  informed_user_ids uuid[],
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_raci_org ON ic_raci_matrix(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_raci_process ON ic_raci_matrix(process_id);

ALTER TABLE ic_raci_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view RACI matrix in their org"
  ON ic_raci_matrix FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage RACI matrix"
  ON ic_raci_matrix FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- GÖREVLER AYRILLIĞI KURALLARI
CREATE TABLE IF NOT EXISTS ic_sod_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_code text NOT NULL,
  rule_name text NOT NULL,
  rule_description text,
  conflicting_function_1 text NOT NULL,
  conflicting_function_2 text NOT NULL,
  risk_if_combined text,
  mitigation_control text,
  status text CHECK (status IN ('active', 'inactive', 'under_review')) DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, rule_code)
);

CREATE INDEX IF NOT EXISTS idx_ic_sod_org ON ic_sod_rules(organization_id);

ALTER TABLE ic_sod_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view SoD rules in their org"
  ON ic_sod_rules FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage SoD rules"
  ON ic_sod_rules FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- ETİK TAAHHÜTLER
CREATE TABLE IF NOT EXISTS ic_ethics_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  commitment_year integer NOT NULL,
  signed_date date NOT NULL,
  document_url text,
  has_conflicts boolean DEFAULT false,
  conflict_details text,
  reviewed_by uuid REFERENCES profiles(id),
  review_date date,
  status text CHECK (status IN ('pending', 'signed', 'reviewed', 'expired')) DEFAULT 'pending',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_ethics_org ON ic_ethics_commitments(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_ethics_user ON ic_ethics_commitments(user_id);
CREATE INDEX IF NOT EXISTS idx_ic_ethics_year ON ic_ethics_commitments(commitment_year);

ALTER TABLE ic_ethics_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own ethics commitments"
  ON ic_ethics_commitments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

CREATE POLICY "Users can create their ethics commitments"
  ON ic_ethics_commitments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update ethics commitments"
  ON ic_ethics_commitments FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );
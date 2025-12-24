/*
  # İç Kontrol Sistem Tabloları - Bölüm 2
  Kontroller, Testler, Bulgular, CAPA
*/

-- KONTROL FAALİYETLERİ
CREATE TABLE IF NOT EXISTS ic_controls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  risk_id uuid REFERENCES ic_risks(id),
  process_id uuid REFERENCES ic_processes(id),
  control_code text NOT NULL,
  control_title text NOT NULL,
  control_description text,
  control_type text CHECK (control_type IN ('preventive', 'detective', 'corrective')) DEFAULT 'preventive',
  control_nature text CHECK (control_nature IN ('manual', 'automated', 'semi_automated')) DEFAULT 'manual',
  frequency text CHECK (frequency IN ('continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'ad_hoc')) DEFAULT 'monthly',
  control_owner_id uuid REFERENCES profiles(id),
  control_performer_id uuid REFERENCES profiles(id),
  design_effectiveness text CHECK (design_effectiveness IN ('effective', 'partially_effective', 'ineffective', 'not_assessed')) DEFAULT 'not_assessed',
  operating_effectiveness text CHECK (operating_effectiveness IN ('effective', 'partially_effective', 'ineffective', 'not_assessed')) DEFAULT 'not_assessed',
  documentation_url text,
  evidence_required text,
  status text CHECK (status IN ('draft', 'active', 'under_review', 'inactive')) DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, control_code)
);

CREATE INDEX IF NOT EXISTS idx_ic_controls_org ON ic_controls(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_controls_risk ON ic_controls(risk_id);
CREATE INDEX IF NOT EXISTS idx_ic_controls_process ON ic_controls(process_id);

ALTER TABLE ic_controls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view controls in their org" ON ic_controls;
CREATE POLICY "Users can view controls in their org"
  ON ic_controls FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Control owners can manage their controls" ON ic_controls;
CREATE POLICY "Control owners can manage their controls"
  ON ic_controls FOR ALL
  TO authenticated
  USING (
    control_owner_id = auth.uid()
    OR process_id IN (
      SELECT id FROM ic_processes
      WHERE department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
    )
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- KONTROL TESTLERİ
CREATE TABLE IF NOT EXISTS ic_control_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  control_id uuid NOT NULL REFERENCES ic_controls(id) ON DELETE CASCADE,
  test_period_start date NOT NULL,
  test_period_end date NOT NULL,
  tester_id uuid REFERENCES profiles(id),
  test_date date NOT NULL,
  sample_size integer,
  exceptions_found integer DEFAULT 0,
  test_result text CHECK (test_result IN ('pass', 'pass_with_exceptions', 'fail', 'not_applicable')) DEFAULT 'pass',
  test_notes text,
  evidence_urls text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_control_tests_org ON ic_control_tests(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_control_tests_control ON ic_control_tests(control_id);

ALTER TABLE ic_control_tests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view control tests in their org" ON ic_control_tests;
CREATE POLICY "Users can view control tests in their org"
  ON ic_control_tests FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can create control tests" ON ic_control_tests;
CREATE POLICY "Users can create control tests"
  ON ic_control_tests FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Testers can update their tests" ON ic_control_tests;
CREATE POLICY "Testers can update their tests"
  ON ic_control_tests FOR UPDATE
  TO authenticated
  USING (
    tester_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- BULGULAR
CREATE TABLE IF NOT EXISTS ic_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  finding_code text NOT NULL,
  finding_title text NOT NULL,
  finding_description text,
  finding_source text CHECK (finding_source IN ('internal_audit', 'external_audit', 'control_test', 'self_assessment', 'management_review')) DEFAULT 'control_test',
  control_test_id uuid REFERENCES ic_control_tests(id),
  risk_id uuid REFERENCES ic_risks(id),
  control_id uuid REFERENCES ic_controls(id),
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  identified_by uuid REFERENCES profiles(id),
  identified_date date NOT NULL,
  status text CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'accepted')) DEFAULT 'open',
  root_cause_analysis text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, finding_code)
);

CREATE INDEX IF NOT EXISTS idx_ic_findings_org ON ic_findings(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_findings_control ON ic_findings(control_id);
CREATE INDEX IF NOT EXISTS idx_ic_findings_status ON ic_findings(status);

ALTER TABLE ic_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view findings in their org" ON ic_findings;
CREATE POLICY "Users can view findings in their org"
  ON ic_findings FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can create findings" ON ic_findings;
CREATE POLICY "Users can create findings"
  ON ic_findings FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- DÖF (CAPA)
CREATE TABLE IF NOT EXISTS ic_capas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  capa_code text NOT NULL,
  capa_type text CHECK (capa_type IN ('corrective', 'preventive', 'both')) DEFAULT 'corrective',
  finding_id uuid REFERENCES ic_findings(id),
  title text NOT NULL,
  description text,
  root_cause text,
  proposed_action text NOT NULL,
  responsible_user_id uuid REFERENCES profiles(id),
  responsible_department_id uuid REFERENCES departments(id),
  due_date date NOT NULL,
  priority text CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  status text CHECK (status IN ('open', 'in_progress', 'pending_verification', 'verified', 'closed', 'overdue')) DEFAULT 'open',
  completion_percentage integer DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
  actual_completion_date date,
  verified_by uuid REFERENCES profiles(id),
  verification_date date,
  verification_notes text,
  effectiveness_review_date date,
  is_effective boolean,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, capa_code)
);

CREATE INDEX IF NOT EXISTS idx_ic_capas_org ON ic_capas(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_capas_finding ON ic_capas(finding_id);
CREATE INDEX IF NOT EXISTS idx_ic_capas_responsible ON ic_capas(responsible_user_id);
CREATE INDEX IF NOT EXISTS idx_ic_capas_status ON ic_capas(status);
CREATE INDEX IF NOT EXISTS idx_ic_capas_due_date ON ic_capas(due_date);

ALTER TABLE ic_capas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view CAPAs in their org" ON ic_capas;
CREATE POLICY "Users can view CAPAs in their org"
  ON ic_capas FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can create CAPAs" ON ic_capas;
CREATE POLICY "Users can create CAPAs"
  ON ic_capas FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Responsible users can update their CAPAs" ON ic_capas;
CREATE POLICY "Responsible users can update their CAPAs"
  ON ic_capas FOR UPDATE
  TO authenticated
  USING (
    responsible_user_id = auth.uid()
    OR responsible_department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- DÖF AKSİYONLARI
CREATE TABLE IF NOT EXISTS ic_capa_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  capa_id uuid NOT NULL REFERENCES ic_capas(id) ON DELETE CASCADE,
  action_date date NOT NULL,
  action_taken text NOT NULL,
  completion_percentage integer CHECK (completion_percentage BETWEEN 0 AND 100),
  evidence_url text,
  entered_by uuid REFERENCES profiles(id),
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_capa_actions_org ON ic_capa_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_capa_actions_capa ON ic_capa_actions(capa_id);

ALTER TABLE ic_capa_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view CAPA actions in their org" ON ic_capa_actions;
CREATE POLICY "Users can view CAPA actions in their org"
  ON ic_capa_actions FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can add CAPA actions" ON ic_capa_actions;
CREATE POLICY "Users can add CAPA actions"
  ON ic_capa_actions FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

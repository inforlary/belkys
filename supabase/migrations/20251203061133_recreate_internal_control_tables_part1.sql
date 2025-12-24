/*
  # İç Kontrol Sistem Tabloları - Bölüm 1
  KİKS Standartları, Süreçler, Riskler
*/

-- KİKS STANDARTLARI
CREATE TABLE IF NOT EXISTS ic_kiks_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  component text NOT NULL CHECK (component IN ('kontrol_ortami', 'risk_degerlendirme', 'kontrol_faaliyetleri', 'bilgi_iletisim', 'izleme')),
  theme text NOT NULL,
  standard_no integer NOT NULL,
  title text NOT NULL,
  description text,
  is_critical boolean DEFAULT false,
  weight integer DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ic_kiks_org ON ic_kiks_standards(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_kiks_component ON ic_kiks_standards(component);

ALTER TABLE ic_kiks_standards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view KİKS standards in their org" ON ic_kiks_standards;
CREATE POLICY "Users can view KİKS standards in their org"
  ON ic_kiks_standards FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Admins can manage KİKS standards" ON ic_kiks_standards;
CREATE POLICY "Admins can manage KİKS standards"
  ON ic_kiks_standards FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- SÜREÇ YÖNETİMİ
CREATE TABLE IF NOT EXISTS ic_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id),
  code text NOT NULL,
  name text NOT NULL,
  description text,
  owner_user_id uuid REFERENCES profiles(id),
  process_category text,
  is_critical boolean DEFAULT false,
  status text CHECK (status IN ('draft', 'active', 'under_review', 'archived')) DEFAULT 'draft',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ic_processes_org ON ic_processes(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_processes_dept ON ic_processes(department_id);

ALTER TABLE ic_processes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view processes in their org" ON ic_processes;
CREATE POLICY "Users can view processes in their org"
  ON ic_processes FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Department users can manage their processes" ON ic_processes;
CREATE POLICY "Department users can manage their processes"
  ON ic_processes FOR ALL
  TO authenticated
  USING (
    department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- RİSK YÖNETİMİ
CREATE TABLE IF NOT EXISTS ic_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  process_id uuid REFERENCES ic_processes(id),
  risk_code text NOT NULL,
  risk_title text NOT NULL,
  risk_description text,
  risk_category text CHECK (risk_category IN ('strategic', 'operational', 'financial', 'compliance', 'reputational')) DEFAULT 'operational',
  risk_owner_id uuid REFERENCES profiles(id),
  inherent_likelihood integer CHECK (inherent_likelihood BETWEEN 1 AND 5),
  inherent_impact integer CHECK (inherent_impact BETWEEN 1 AND 5),
  inherent_score integer GENERATED ALWAYS AS (inherent_likelihood * inherent_impact) STORED,
  residual_likelihood integer CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_impact integer CHECK (residual_impact BETWEEN 1 AND 5),
  residual_score integer GENERATED ALWAYS AS (residual_likelihood * residual_impact) STORED,
  status text CHECK (status IN ('identified', 'assessed', 'mitigating', 'monitored', 'accepted', 'closed')) DEFAULT 'identified',
  last_assessment_date date,
  next_review_date date,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, risk_code)
);

CREATE INDEX IF NOT EXISTS idx_ic_risks_org ON ic_risks(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_risks_process ON ic_risks(process_id);
CREATE INDEX IF NOT EXISTS idx_ic_risks_category ON ic_risks(risk_category);

ALTER TABLE ic_risks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view risks in their org" ON ic_risks;
CREATE POLICY "Users can view risks in their org"
  ON ic_risks FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Process owners can manage their risks" ON ic_risks;
CREATE POLICY "Process owners can manage their risks"
  ON ic_risks FOR ALL
  TO authenticated
  USING (
    process_id IN (
      SELECT id FROM ic_processes
      WHERE department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
      OR owner_user_id = auth.uid()
    )
    OR risk_owner_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

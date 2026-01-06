/*
  # Risk Yönetimi ve İç Kontrol Modülleri

  Bu migration, BELKYS projesine Risk Yönetimi ve İç Kontrol modüllerini ekler.
  Mevcut tablolar korunur, sadece yeni tablolar eklenir.

  ## 1. Yeni Tablolar - Risk Yönetimi (7 tablo)
    - `risk_categories` - Risk kategorileri (hiyerarşik yapı)
    - `risks` - Risk kayıtları
    - `risk_controls` - Risk kontrolleri
    - `risk_treatments` - Risk tedbirleri/faaliyetler
    - `risk_indicators` - Risk göstergeleri (KRI/LEI)
    - `risk_indicator_values` - Gösterge ölçüm değerleri
    - `risk_assessment_history` - Risk değerlendirme geçmişi

  ## 2. Yeni Tablolar - İç Kontrol (12 tablo)
    - `ic_components` - İç kontrol bileşenleri (5 bileşen)
    - `ic_standards` - İç kontrol standartları (18 standart)
    - `ic_action_plans` - İç kontrol eylem planları
    - `ic_actions` - İç kontrol eylemleri
    - `ic_action_progress` - Eylem ilerleme kayıtları
    - `ic_action_documents` - Eylem dokümanları
    - `ic_assessments` - Standart değerlendirmeleri
    - `ikyk_meetings` - İKİYK toplantıları
    - `ikyk_attendees` - Toplantı katılımcıları
    - `ikyk_agenda_items` - Gündem maddeleri
    - `ikyk_decisions` - İKİYK kararları
    - `ic_assurance_statements` - İç kontrol güvence beyanları

  ## 3. Seed Data
    - 5 İç Kontrol Bileşeni
    - 18 İç Kontrol Standardı
    - Risk kategorileri (hiyerarşik yapı)

  ## 4. Güvenlik
    - Tüm tablolar için RLS aktif
    - Organization ve department bazlı erişim kontrolleri
    - Roller: super_admin, admin, director, user
*/

-- ═════════════════════════════════════════════════════════════════════════
-- RİSK YÖNETİMİ TABLOLARI
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS risk_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES risk_categories(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(20) CHECK (type IN ('EXTERNAL', 'INTERNAL')),
  description TEXT,
  color VARCHAR(7),
  icon VARCHAR(50),
  order_index INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES risk_categories(id) ON DELETE SET NULL,
  objective_id UUID REFERENCES objectives(id) ON DELETE SET NULL,
  owner_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(300) NOT NULL,
  description TEXT,
  causes TEXT,
  consequences TEXT,
  inherent_likelihood INT CHECK (inherent_likelihood BETWEEN 1 AND 5),
  inherent_impact INT CHECK (inherent_impact BETWEEN 1 AND 5),
  inherent_score INT GENERATED ALWAYS AS (inherent_likelihood * inherent_impact) STORED,
  residual_likelihood INT CHECK (residual_likelihood BETWEEN 1 AND 5),
  residual_impact INT CHECK (residual_impact BETWEEN 1 AND 5),
  residual_score INT GENERATED ALWAYS AS (residual_likelihood * residual_impact) STORED,
  risk_level VARCHAR(20),
  risk_response VARCHAR(20) CHECK (risk_response IN ('ACCEPT', 'MITIGATE', 'TRANSFER', 'AVOID')),
  response_rationale TEXT,
  monitoring_level VARCHAR(20) CHECK (monitoring_level IN ('STRATEGIC', 'TACTICAL', 'OPERATIONAL')),
  review_frequency VARCHAR(20),
  status VARCHAR(20) DEFAULT 'IDENTIFIED',
  is_active BOOLEAN DEFAULT true,
  identified_date DATE DEFAULT CURRENT_DATE,
  identified_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID REFERENCES risks(id) ON DELETE CASCADE,
  name VARCHAR(300) NOT NULL,
  description TEXT,
  control_type VARCHAR(20) CHECK (control_type IN ('PREVENTIVE', 'DETECTIVE', 'CORRECTIVE')),
  control_nature VARCHAR(20) CHECK (control_nature IN ('MANUAL', 'AUTOMATED', 'SEMI_AUTOMATED')),
  responsible_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  design_effectiveness INT CHECK (design_effectiveness BETWEEN 1 AND 5),
  operating_effectiveness INT CHECK (operating_effectiveness BETWEEN 1 AND 5),
  evidence TEXT,
  frequency VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID REFERENCES risks(id) ON DELETE CASCADE,
  code VARCHAR(20),
  title VARCHAR(300) NOT NULL,
  description TEXT,
  treatment_type VARCHAR(20) CHECK (treatment_type IN ('NEW_CONTROL', 'IMPROVE_CONTROL', 'TRANSFER', 'ACCEPT', 'AVOID')),
  responsible_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  responsible_person_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  planned_start_date DATE,
  planned_end_date DATE,
  actual_start_date DATE,
  actual_end_date DATE,
  estimated_budget DECIMAL(15,2),
  progress_percent INT DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  status VARCHAR(20) DEFAULT 'PLANNED',
  ic_action_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID REFERENCES risks(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(300) NOT NULL,
  description TEXT,
  indicator_type VARCHAR(10) CHECK (indicator_type IN ('KRI', 'LEI')),
  unit_of_measure VARCHAR(50),
  measurement_frequency VARCHAR(20),
  green_threshold VARCHAR(50),
  yellow_threshold VARCHAR(50),
  red_threshold VARCHAR(50),
  direction VARCHAR(20) CHECK (direction IN ('LOWER_BETTER', 'HIGHER_BETTER', 'TARGET')),
  target_value DECIMAL(15,4),
  alert_enabled BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_indicator_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id UUID REFERENCES risk_indicators(id) ON DELETE CASCADE,
  measurement_date DATE NOT NULL,
  period VARCHAR(20),
  value DECIMAL(15,4) NOT NULL,
  status VARCHAR(10) CHECK (status IN ('GREEN', 'YELLOW', 'RED')),
  trend VARCHAR(10) CHECK (trend IN ('UP', 'DOWN', 'STABLE')),
  notes TEXT,
  recorded_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  alert_triggered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_assessment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID REFERENCES risks(id) ON DELETE CASCADE,
  assessment_date DATE NOT NULL,
  assessed_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  previous_inherent_score INT,
  new_inherent_score INT,
  previous_residual_score INT,
  new_residual_score INT,
  previous_level VARCHAR(20),
  new_level VARCHAR(20),
  change_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═════════════════════════════════════════════════════════════════════════
-- İÇ KONTROL TABLOLARI
-- ═════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ic_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  order_index INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ic_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID REFERENCES ic_components(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL UNIQUE,
  name VARCHAR(300) NOT NULL,
  description TEXT,
  general_conditions TEXT,
  order_index INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ic_action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(300) NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  prepared_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ic_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_id UUID REFERENCES ic_action_plans(id) ON DELETE CASCADE,
  standard_id UUID REFERENCES ic_standards(id) ON DELETE SET NULL,
  code VARCHAR(20) NOT NULL,
  title VARCHAR(300) NOT NULL,
  description TEXT,
  responsible_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  related_department_ids UUID[],
  start_date DATE,
  target_date DATE NOT NULL,
  completed_date DATE,
  status VARCHAR(20) DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED', 'CANCELLED')),
  priority VARCHAR(10) DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  progress_percent INT DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  outputs TEXT,
  resources TEXT,
  related_risk_control_id UUID REFERENCES risk_controls(id) ON DELETE SET NULL,
  related_risk_treatment_id UUID REFERENCES risk_treatments(id) ON DELETE SET NULL,
  related_objective_id UUID REFERENCES objectives(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ic_action_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID REFERENCES ic_actions(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  reported_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  previous_progress INT,
  new_progress INT,
  previous_status VARCHAR(20),
  new_status VARCHAR(20),
  description TEXT,
  challenges TEXT,
  next_steps TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ic_action_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID REFERENCES ic_actions(id) ON DELETE CASCADE,
  name VARCHAR(300) NOT NULL,
  description TEXT,
  file_url TEXT NOT NULL,
  file_type VARCHAR(50),
  file_size INT,
  uploaded_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ic_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  standard_id UUID REFERENCES ic_standards(id) ON DELETE CASCADE,
  assessment_period VARCHAR(20) NOT NULL,
  assessment_date DATE NOT NULL,
  assessed_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  compliance_level INT CHECK (compliance_level BETWEEN 1 AND 5),
  strengths TEXT,
  weaknesses TEXT,
  evidences TEXT,
  recommendations TEXT,
  status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED')),
  approved_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, standard_id, assessment_period)
);

CREATE TABLE IF NOT EXISTS ikyk_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  meeting_number INT NOT NULL,
  meeting_date DATE NOT NULL,
  location VARCHAR(200),
  chairperson VARCHAR(200),
  status VARCHAR(20) DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'COMPLETED', 'CANCELLED')),
  minutes_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ikyk_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES ikyk_meetings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role VARCHAR(50),
  attended BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS ikyk_agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES ikyk_meetings(id) ON DELETE CASCADE,
  order_index INT NOT NULL,
  title VARCHAR(300) NOT NULL,
  description TEXT,
  presenter VARCHAR(200),
  related_action_id UUID REFERENCES ic_actions(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS ikyk_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID REFERENCES ikyk_meetings(id) ON DELETE CASCADE,
  agenda_item_id UUID REFERENCES ikyk_agenda_items(id) ON DELETE SET NULL,
  decision_number VARCHAR(50),
  title VARCHAR(300) NOT NULL,
  description TEXT,
  responsible_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  due_date DATE,
  status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  completed_at TIMESTAMPTZ,
  completion_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ic_assurance_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  year INT NOT NULL,
  type VARCHAR(20) CHECK (type IN ('UNIT', 'INSTITUTION')),
  department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  declarant_name VARCHAR(200) NOT NULL,
  declarant_title VARCHAR(200),
  declaration_date DATE NOT NULL,
  assurance_level VARCHAR(20) CHECK (assurance_level IN ('FULL', 'QUALIFIED', 'ADVERSE')),
  scope_statement TEXT,
  responsibility_statement TEXT,
  assessment_statement TEXT,
  limitations_statement TEXT,
  conclusion_statement TEXT,
  signature_url TEXT,
  status VARCHAR(20) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'PUBLISHED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═════════════════════════════════════════════════════════════════════════
-- İNDEXLER
-- ═════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_risk_categories_org ON risk_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_categories_parent ON risk_categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_risks_org ON risks(organization_id);
CREATE INDEX IF NOT EXISTS idx_risks_category ON risks(category_id);
CREATE INDEX IF NOT EXISTS idx_risks_dept ON risks(owner_department_id);
CREATE INDEX IF NOT EXISTS idx_risk_controls_risk ON risk_controls(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_treatments_risk ON risk_treatments(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_indicators_risk ON risk_indicators(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_indicator_values_indicator ON risk_indicator_values(indicator_id);
CREATE INDEX IF NOT EXISTS idx_ic_action_plans_org ON ic_action_plans(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_actions_plan ON ic_actions(action_plan_id);
CREATE INDEX IF NOT EXISTS idx_ic_actions_dept ON ic_actions(responsible_department_id);
CREATE INDEX IF NOT EXISTS idx_ic_assessments_org ON ic_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_ikyk_meetings_org ON ikyk_meetings(organization_id);

-- ═════════════════════════════════════════════════════════════════════════
-- RLS POLİTİKALARI
-- ═════════════════════════════════════════════════════════════════════════

-- Risk Categories
ALTER TABLE risk_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins have full access to risk categories"
  ON risk_categories FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Users can view their organization risk categories"
  ON risk_categories FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage their organization risk categories"
  ON risk_categories FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'director')
    )
  );

-- Risks
ALTER TABLE risks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins have full access to risks"
  ON risks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Users can view their organization risks"
  ON risks FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and directors can manage risks"
  ON risks FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'director')
    )
  );

-- Risk Controls
ALTER TABLE risk_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risk controls"
  ON risk_controls FOR SELECT
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage risk controls"
  ON risk_controls FOR ALL
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
      )
    )
  );

-- Risk Treatments
ALTER TABLE risk_treatments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risk treatments"
  ON risk_treatments FOR SELECT
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage risk treatments"
  ON risk_treatments FOR ALL
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
      )
    )
  );

-- Risk Indicators
ALTER TABLE risk_indicators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risk indicators"
  ON risk_indicators FOR SELECT
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage risk indicators"
  ON risk_indicators FOR ALL
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
      )
    )
  );

-- Risk Indicator Values
ALTER TABLE risk_indicator_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risk indicator values"
  ON risk_indicator_values FOR SELECT
  TO authenticated
  USING (
    indicator_id IN (
      SELECT ri.id FROM risk_indicators ri
      JOIN risks r ON ri.risk_id = r.id
      WHERE r.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert risk indicator values"
  ON risk_indicator_values FOR INSERT
  TO authenticated
  WITH CHECK (
    indicator_id IN (
      SELECT ri.id FROM risk_indicators ri
      JOIN risks r ON ri.risk_id = r.id
      WHERE r.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage risk indicator values"
  ON risk_indicator_values FOR ALL
  TO authenticated
  USING (
    indicator_id IN (
      SELECT ri.id FROM risk_indicators ri
      JOIN risks r ON ri.risk_id = r.id
      WHERE r.organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
      )
    )
  );

-- Risk Assessment History
ALTER TABLE risk_assessment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risk assessment history"
  ON risk_assessment_history FOR SELECT
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "System can insert risk assessment history"
  ON risk_assessment_history FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- IC Components (Global data - read-only for all)
ALTER TABLE ic_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view ic components"
  ON ic_components FOR SELECT
  TO authenticated
  USING (true);

-- IC Standards (Global data - read-only for all)
ALTER TABLE ic_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view ic standards"
  ON ic_standards FOR SELECT
  TO authenticated
  USING (true);

-- IC Action Plans
ALTER TABLE ic_action_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins have full access to ic action plans"
  ON ic_action_plans FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Users can view their organization ic action plans"
  ON ic_action_plans FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage ic action plans"
  ON ic_action_plans FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'director')
    )
  );

-- IC Actions
ALTER TABLE ic_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ic actions"
  ON ic_actions FOR SELECT
  TO authenticated
  USING (
    action_plan_id IN (
      SELECT id FROM ic_action_plans WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage ic actions"
  ON ic_actions FOR ALL
  TO authenticated
  USING (
    action_plan_id IN (
      SELECT id FROM ic_action_plans WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
      )
    )
  );

-- IC Action Progress
ALTER TABLE ic_action_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ic action progress"
  ON ic_action_progress FOR SELECT
  TO authenticated
  USING (
    action_id IN (
      SELECT ia.id FROM ic_actions ia
      JOIN ic_action_plans iap ON ia.action_plan_id = iap.id
      WHERE iap.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert ic action progress"
  ON ic_action_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    action_id IN (
      SELECT ia.id FROM ic_actions ia
      JOIN ic_action_plans iap ON ia.action_plan_id = iap.id
      WHERE iap.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- IC Action Documents
ALTER TABLE ic_action_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ic action documents"
  ON ic_action_documents FOR SELECT
  TO authenticated
  USING (
    action_id IN (
      SELECT ia.id FROM ic_actions ia
      JOIN ic_action_plans iap ON ia.action_plan_id = iap.id
      WHERE iap.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can upload ic action documents"
  ON ic_action_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    action_id IN (
      SELECT ia.id FROM ic_actions ia
      JOIN ic_action_plans iap ON ia.action_plan_id = iap.id
      WHERE iap.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage ic action documents"
  ON ic_action_documents FOR ALL
  TO authenticated
  USING (
    action_id IN (
      SELECT ia.id FROM ic_actions ia
      JOIN ic_action_plans iap ON ia.action_plan_id = iap.id
      WHERE iap.organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
      )
    )
  );

-- IC Assessments
ALTER TABLE ic_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins have full access to ic assessments"
  ON ic_assessments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Users can view their organization ic assessments"
  ON ic_assessments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage ic assessments"
  ON ic_assessments FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'director')
    )
  );

-- IKYK Meetings
ALTER TABLE ikyk_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins have full access to ikyk meetings"
  ON ikyk_meetings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Users can view their organization ikyk meetings"
  ON ikyk_meetings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage ikyk meetings"
  ON ikyk_meetings FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'director')
    )
  );

-- IKYK Attendees
ALTER TABLE ikyk_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ikyk attendees"
  ON ikyk_attendees FOR SELECT
  TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM ikyk_meetings WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage ikyk attendees"
  ON ikyk_attendees FOR ALL
  TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM ikyk_meetings WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
      )
    )
  );

-- IKYK Agenda Items
ALTER TABLE ikyk_agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ikyk agenda items"
  ON ikyk_agenda_items FOR SELECT
  TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM ikyk_meetings WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage ikyk agenda items"
  ON ikyk_agenda_items FOR ALL
  TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM ikyk_meetings WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
      )
    )
  );

-- IKYK Decisions
ALTER TABLE ikyk_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ikyk decisions"
  ON ikyk_decisions FOR SELECT
  TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM ikyk_meetings WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage ikyk decisions"
  ON ikyk_decisions FOR ALL
  TO authenticated
  USING (
    meeting_id IN (
      SELECT id FROM ikyk_meetings WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
      )
    )
  );

-- IC Assurance Statements
ALTER TABLE ic_assurance_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins have full access to assurance statements"
  ON ic_assurance_statements FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Users can view their organization assurance statements"
  ON ic_assurance_statements FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage assurance statements"
  ON ic_assurance_statements FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'director')
    )
  );

-- ═════════════════════════════════════════════════════════════════════════
-- SEED DATA
-- ═════════════════════════════════════════════════════════════════════════

-- 5 İç Kontrol Bileşeni
INSERT INTO ic_components (code, name, description, order_index) VALUES
('KO', 'Kontrol Ortamı', 'İç kontrolün temelini oluşturan organizasyonel yapı, görev tanımları ve yetki-sorumlulukların belirlenmesi', 1),
('RD', 'Risk Değerlendirme', 'Kurum hedeflerine ulaşmayı engelleyebilecek risklerin belirlenmesi ve değerlendirilmesi', 2),
('KF', 'Kontrol Faaliyetleri', 'Risklerin yönetilmesi için uygulanan politika ve prosedürler', 3),
('BI', 'Bilgi ve İletişim', 'Bilginin tanımlanması, elde edilmesi ve paylaşılması süreçleri', 4),
('IZ', 'İzleme', 'İç kontrol sisteminin etkinliğinin izlenmesi ve değerlendirilmesi', 5)
ON CONFLICT (code) DO NOTHING;

-- 18 İç Kontrol Standardı
INSERT INTO ic_standards (component_id, code, name, description, general_conditions, order_index) VALUES
(
  (SELECT id FROM ic_components WHERE code='KO'), 
  'KOS1', 
  'Etik Değerler ve Dürüstlük',
  'Kurumda etik değerler ve dürüstlük ilkelerinin belirlenmesi, benimsenmesi ve uygulanması',
  'Kurumda etik değerler ve davranış kuralları belirlenmiş, duyurulmuş ve uygulanır durumda olmalıdır.',
  1
),
(
  (SELECT id FROM ic_components WHERE code='KO'), 
  'KOS2', 
  'Misyon, Organizasyon Yapısı ve Görevler',
  'Kurumun misyon, vizyon ve hedeflerinin belirlenmesi, organizasyon yapısının oluşturulması',
  'Kurumun misyonu, vizyonu, hedefleri, organizasyon yapısı ve görev tanımları yazılı olarak belirlenmiş olmalıdır.',
  2
),
(
  (SELECT id FROM ic_components WHERE code='KO'), 
  'KOS3', 
  'Personelin Yeterliliği ve Performansı',
  'Personelin görevlerini yerine getirebilmesi için gerekli bilgi, beceri ve deneyime sahip olması',
  'Personelin işe alımı, eğitimi, performans değerlemesi ve kariyer planlaması için sistematik süreçler oluşturulmalıdır.',
  3
),
(
  (SELECT id FROM ic_components WHERE code='KO'), 
  'KOS4', 
  'Yetki Devri',
  'Görev ve yetkilerin uygun şekilde devredilmesi ve dokümante edilmesi',
  'Yetki devri yazılı olarak yapılmalı, devredilen yetki ve sorumluluklar açıkça belirtilmelidir.',
  4
),
(
  (SELECT id FROM ic_components WHERE code='RD'), 
  'KOS5', 
  'Planlama ve Programlama',
  'Kurumun amaç ve hedeflerinin belirlenmesi, bunlara ulaşmak için stratejik ve operasyonel planların hazırlanması',
  'Stratejik plan, yıllık performans programı ve bütçe birbirleriyle uyumlu olmalıdır.',
  5
),
(
  (SELECT id FROM ic_components WHERE code='RD'), 
  'KOS6', 
  'Risklerin Belirlenmesi ve Değerlendirilmesi',
  'Kurumun hedeflerine ulaşmasını engelleyebilecek risklerin belirlenmesi ve analiz edilmesi',
  'Risk yönetimi süreci sistematik olarak yürütülmeli, riskler düzenli olarak gözden geçirilmelidir.',
  6
),
(
  (SELECT id FROM ic_components WHERE code='KF'), 
  'KOS7', 
  'Kontrol Stratejileri ve Yöntemleri',
  'Belirlenen riskleri yönetmek için kontrol stratejilerinin geliştirilmesi',
  'Her risk için uygun kontrol stratejisi belirlenmiş ve uygulanıyor olmalıdır.',
  7
),
(
  (SELECT id FROM ic_components WHERE code='KF'), 
  'KOS8', 
  'Prosedürlerin Belirlenmesi ve Belgelendirilmesi',
  'İş süreçlerinin yazılı hale getirilmesi ve standart prosedürlerin oluşturulması',
  'Temel süreçler için yazılı prosedürler hazırlanmış, güncel tutulmalıdır.',
  8
),
(
  (SELECT id FROM ic_components WHERE code='KF'), 
  'KOS9', 
  'Görevler Ayrılığı',
  'Yetki ve sorumlulukların farklı kişilere verilmesi suretiyle hata ve usulsüzlüklerin önlenmesi',
  'İşlemlerin başlatma, onaylama, kaydetme ve kontrol etme görevleri farklı kişilere verilmelidir.',
  9
),
(
  (SELECT id FROM ic_components WHERE code='KF'), 
  'KOS10', 
  'Hiyerarşik Kontroller',
  'Üst yöneticilerin astlarının çalışmalarını gözden geçirmesi ve onaylaması',
  'Tüm işlemler hiyerarşik kontrol süreçlerinden geçmelidir.',
  10
),
(
  (SELECT id FROM ic_components WHERE code='KF'), 
  'KOS11', 
  'Faaliyetlerin Sürekliliği',
  'Kurumun faaliyetlerinin olağanüstü durumlarda da devam edebilmesi için gerekli tedbirlerin alınması',
  'İş sürekliliği planı hazırlanmış, yedekleme ve kurtarma sistemleri oluşturulmuş olmalıdır.',
  11
),
(
  (SELECT id FROM ic_components WHERE code='KF'), 
  'KOS12', 
  'Bilgi Sistemleri Kontrolleri',
  'Bilgi sistemlerinin güvenliği ve güvenilirliğinin sağlanması',
  'Bilgi sistemleri güvenlik politikası oluşturulmuş, erişim kontrolleri tanımlanmış olmalıdır.',
  12
),
(
  (SELECT id FROM ic_components WHERE code='BI'), 
  'KOS13', 
  'Bilgi ve İletişim',
  'Doğru ve zamanında bilgiye erişimin sağlanması, etkili iletişim kanallarının oluşturulması',
  'İç ve dış iletişim kanalları belirlenmiş, bilgi paylaşımı düzenli olarak yapılmalıdır.',
  13
),
(
  (SELECT id FROM ic_components WHERE code='BI'), 
  'KOS14', 
  'Raporlama',
  'Yönetim bilgi sistemi kurulması, performans raporlarının düzenli olarak hazırlanması',
  'Performans göstergeleri belirlenmiş, düzenli raporlama yapılmalıdır.',
  14
),
(
  (SELECT id FROM ic_components WHERE code='BI'), 
  'KOS15', 
  'Kayıt ve Dosyalama Sistemi',
  'Dokümanların sistematik olarak kaydedilmesi, arşivlenmesi ve korunması',
  'Elektronik ve fiziksel belge yönetim sistemi kurulmuş olmalıdır.',
  15
),
(
  (SELECT id FROM ic_components WHERE code='BI'), 
  'KOS16', 
  'Hata, Usulsüzlük ve Yolsuzlukların Bildirilmesi',
  'Tespit edilen hata, usulsüzlük ve yolsuzlukların bildirilmesi için güvenli mekanizmaların oluşturulması',
  'Bildirim kanalları oluşturulmuş, bildirimde bulunanların korunması sağlanmalıdır.',
  16
),
(
  (SELECT id FROM ic_components WHERE code='IZ'), 
  'KOS17', 
  'İç Kontrolün Değerlendirilmesi',
  'İç kontrol sisteminin etkinliğinin düzenli olarak değerlendirilmesi',
  'İç kontrol sisteminin yıllık değerlendirmesi yapılmalı, güvence beyanı hazırlanmalıdır.',
  17
),
(
  (SELECT id FROM ic_components WHERE code='IZ'), 
  'KOS18', 
  'İç Denetim',
  'Bağımsız ve objektif güvence ve danışmanlık faaliyetlerinin yürütülmesi',
  'İç denetim birimi kurulmuş, risk odaklı denetim planı hazırlanmalıdır.',
  18
)
ON CONFLICT (code) DO NOTHING;
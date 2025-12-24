/*
  # İç Kontrol Sistemi - Kapsamlı Veritabanı Şeması

  ## Genel Bakış
  Bu migration, Kamu İç Kontrol Standartları (KİKS) uyumlu, COSO çerçevesine dayalı
  kapsamlı bir iç kontrol sisteminin temelini oluşturur.

  ## 1. Yeni Tablolar

  ### KİKS ve Kurumsal Çerçeve
    - `ic_kiks_standards` - Kamu İç Kontrol Standartları sözlüğü
    - `ic_raci_matrix` - Roller ve sorumluluklar (RACI) matrisi
    - `ic_sod_rules` - Görevler Ayrılığı (Segregation of Duties) kuralları
    - `ic_ethics_commitments` - Etik taahhütler ve bildirimler

  ### Süreç Yönetimi
    - `ic_processes` - Süreç envanteri
    - `ic_process_steps` - Süreç adımları ve akış haritası
    - `ic_critical_control_points` - Kritik Kontrol Noktaları (KKN)

  ### Risk Yönetimi
    - `ic_risks` - Risk envanteri
    - `ic_risk_appetite` - Risk iştahı ve eşikler
    - `ic_risk_assessments` - Risk değerlendirme kayıtları

  ### Kontrol Faaliyetleri
    - `ic_controls` - Kontrol envanteri
    - `ic_control_tests` - Kontrol testleri
    - `ic_control_evidences` - Kontrol kanıtları

  ### DÖF ve İzleme
    - `ic_findings` - Bulgular (iç denetim, test sonuçları)
    - `ic_capas` - Düzeltici/Önleyici Faaliyetler (DÖF)
    - `ic_capa_actions` - DÖF aksiyonları ve ilerleme kayıtları

  ### Raporlama ve İlişkiler
    - `ic_process_kiks_mappings` - Süreç-KİKS eşleştirmeleri
    - `ic_risk_goal_mappings` - Risk-Hedef eşleştirmeleri (5018 entegrasyonu)
    - `ic_audit_logs` - İç kontrol audit log'ları

  ## 2. Güvenlik
    - RLS (Row Level Security) tüm tablolarda aktif
    - Roller bazlı erişim kontrolleri
    - Organizasyon izolasyonu

  ## 3. İlişkiler
    - Süreç → Adımlar → KKN
    - Süreç/Adım → Riskler → Kontroller
    - Kontrol → Testler → Bulgular → DÖF
    - KİKS ↔ Süreç/Risk/Kontrol (çoklu eşleştirme)
    - Risk ↔ Stratejik Hedefler (5018 entegrasyon)
*/

-- ============================================================================
-- 1. KİKS STANDARTLARI (Sözlük)
-- ============================================================================

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

CREATE INDEX idx_ic_kiks_org ON ic_kiks_standards(organization_id);
CREATE INDEX idx_ic_kiks_component ON ic_kiks_standards(component);

ALTER TABLE ic_kiks_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view KİKS standards in their org"
  ON ic_kiks_standards FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage KİKS standards"
  ON ic_kiks_standards FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- ============================================================================
-- 2. RACI MATRİSİ
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_raci_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  process_id uuid REFERENCES ic_processes(id) ON DELETE CASCADE,
  process_step_id uuid REFERENCES ic_process_steps(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  responsible_user_id uuid REFERENCES profiles(id),
  responsible_department_id uuid REFERENCES departments(id),
  accountable_user_id uuid REFERENCES profiles(id),
  consulted_users uuid[] DEFAULT ARRAY[]::uuid[],
  informed_users uuid[] DEFAULT ARRAY[]::uuid[],
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ic_raci_org ON ic_raci_matrix(organization_id);
CREATE INDEX idx_ic_raci_process ON ic_raci_matrix(process_id);

ALTER TABLE ic_raci_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view RACI in their org"
  ON ic_raci_matrix FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage RACI"
  ON ic_raci_matrix FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- ============================================================================
-- 3. SoD (Segregation of Duties) KURALLARI
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_sod_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  description text,
  conflicting_step1_id uuid REFERENCES ic_process_steps(id),
  conflicting_step2_id uuid REFERENCES ic_process_steps(id),
  severity text CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ic_sod_org ON ic_sod_rules(organization_id);

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

-- ============================================================================
-- 4. ETİK TAAHHÜTLER
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_ethics_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  commitment_type text CHECK (commitment_type IN ('initial', 'annual', 'specific')) DEFAULT 'initial',
  commitment_text text NOT NULL,
  signed_at timestamptz DEFAULT now(),
  document_url text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ic_ethics_org ON ic_ethics_commitments(organization_id);
CREATE INDEX idx_ic_ethics_user ON ic_ethics_commitments(user_id);

ALTER TABLE ic_ethics_commitments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ethics commitments"
  ON ic_ethics_commitments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
  ));

CREATE POLICY "Users can create own ethics commitments"
  ON ic_ethics_commitments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ============================================================================
-- 5. SÜREÇ YÖNETİMİ
-- ============================================================================

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

CREATE INDEX idx_ic_processes_org ON ic_processes(organization_id);
CREATE INDEX idx_ic_processes_dept ON ic_processes(department_id);

ALTER TABLE ic_processes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view processes in their org"
  ON ic_processes FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

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

-- ============================================================================
-- 6. SÜREÇ ADIMLARI
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_process_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES ic_processes(id) ON DELETE CASCADE,
  step_number integer NOT NULL,
  step_name text NOT NULL,
  description text,
  responsible_role text,
  responsible_user_id uuid REFERENCES profiles(id),
  input_requirements text,
  output_deliverables text,
  duration_estimate interval,
  is_critical_control_point boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ic_process_steps_org ON ic_process_steps(organization_id);
CREATE INDEX idx_ic_process_steps_process ON ic_process_steps(process_id);

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

-- ============================================================================
-- 7. KRİTİK KONTROL NOKTALARI (KKN)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_critical_control_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  process_step_id uuid NOT NULL REFERENCES ic_process_steps(id) ON DELETE CASCADE,
  control_point_name text NOT NULL,
  hazard_description text,
  critical_limit text,
  monitoring_procedure text,
  corrective_action text,
  verification_procedure text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ic_kkn_org ON ic_critical_control_points(organization_id);
CREATE INDEX idx_ic_kkn_step ON ic_critical_control_points(process_step_id);

ALTER TABLE ic_critical_control_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view KKN in their org"
  ON ic_critical_control_points FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Process owners can manage KKN"
  ON ic_critical_control_points FOR ALL
  TO authenticated
  USING (
    process_step_id IN (
      SELECT ps.id FROM ic_process_steps ps
      JOIN ic_processes p ON ps.process_id = p.id
      WHERE p.department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
      OR p.owner_user_id = auth.uid()
    )
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- ============================================================================
-- 8. RİSK YÖNETİMİ
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  process_id uuid REFERENCES ic_processes(id),
  process_step_id uuid REFERENCES ic_process_steps(id),
  risk_code text NOT NULL,
  risk_title text NOT NULL,
  risk_description text,
  risk_category text CHECK (risk_category IN ('strategic', 'operational', 'financial', 'compliance', 'reputational')) DEFAULT 'operational',
  risk_owner_id uuid REFERENCES profiles(id),

  -- Inherent Risk (Doğal Risk)
  inherent_likelihood integer CHECK (inherent_likelihood BETWEEN 1 AND 5),
  inherent_impact integer CHECK (inherent_impact BETWEEN 1 AND 5),
  inherent_score integer GENERATED ALWAYS AS (inherent_likelihood * inherent_impact) STORED,

  -- Residual Risk (Artık Risk)
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

CREATE INDEX idx_ic_risks_org ON ic_risks(organization_id);
CREATE INDEX idx_ic_risks_process ON ic_risks(process_id);
CREATE INDEX idx_ic_risks_category ON ic_risks(risk_category);

ALTER TABLE ic_risks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risks in their org"
  ON ic_risks FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

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

-- ============================================================================
-- 9. RİSK İŞTAHI & EŞİKLER
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_risk_appetite (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  risk_category text,
  appetite_level text CHECK (appetite_level IN ('averse', 'minimal', 'cautious', 'open', 'hungry')) DEFAULT 'cautious',
  threshold_low integer DEFAULT 5,
  threshold_medium integer DEFAULT 10,
  threshold_high integer DEFAULT 15,
  threshold_critical integer DEFAULT 20,
  description text,
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  valid_from date NOT NULL,
  valid_to date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ic_risk_appetite_org ON ic_risk_appetite(organization_id);

ALTER TABLE ic_risk_appetite ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risk appetite in their org"
  ON ic_risk_appetite FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage risk appetite"
  ON ic_risk_appetite FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- ============================================================================
-- 10. RİSK DEĞERLENDİRME KAYITLARI
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_risk_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  risk_id uuid NOT NULL REFERENCES ic_risks(id) ON DELETE CASCADE,
  assessed_by uuid REFERENCES profiles(id),
  assessment_date date NOT NULL,
  likelihood integer CHECK (likelihood BETWEEN 1 AND 5),
  impact integer CHECK (impact BETWEEN 1 AND 5),
  score integer GENERATED ALWAYS AS (likelihood * impact) STORED,
  assessment_notes text,
  mitigation_status text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ic_risk_assessments_org ON ic_risk_assessments(organization_id);
CREATE INDEX idx_ic_risk_assessments_risk ON ic_risk_assessments(risk_id);

ALTER TABLE ic_risk_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risk assessments in their org"
  ON ic_risk_assessments FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create risk assessments"
  ON ic_risk_assessments FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- 11. KONTROL FAALİYETLERİ
-- ============================================================================

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

  -- Etkinlik Değerlendirmeleri
  design_effectiveness text CHECK (design_effectiveness IN ('effective', 'partially_effective', 'ineffective', 'not_assessed')) DEFAULT 'not_assessed',
  operating_effectiveness text CHECK (operating_effectiveness IN ('effective', 'partially_effective', 'ineffective', 'not_assessed')) DEFAULT 'not_assessed',

  -- SoD Kontrolü
  is_sod_control boolean DEFAULT false,
  sod_rule_id uuid REFERENCES ic_sod_rules(id),

  -- Dokümantasyon
  documentation_url text,
  evidence_required text,

  status text CHECK (status IN ('draft', 'active', 'under_review', 'inactive')) DEFAULT 'active',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, control_code)
);

CREATE INDEX idx_ic_controls_org ON ic_controls(organization_id);
CREATE INDEX idx_ic_controls_risk ON ic_controls(risk_id);
CREATE INDEX idx_ic_controls_process ON ic_controls(process_id);

ALTER TABLE ic_controls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view controls in their org"
  ON ic_controls FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

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

-- Dosya devam edecek...

-- ============================================================================
-- 12. KONTROL TESTLERİ
-- ============================================================================

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

CREATE INDEX idx_ic_control_tests_org ON ic_control_tests(organization_id);
CREATE INDEX idx_ic_control_tests_control ON ic_control_tests(control_id);

ALTER TABLE ic_control_tests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view control tests in their org"
  ON ic_control_tests FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create control tests"
  ON ic_control_tests FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

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

-- ============================================================================
-- 13. KONTROL KANITLARI
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_control_evidences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  control_id uuid NOT NULL REFERENCES ic_controls(id) ON DELETE CASCADE,
  test_id uuid REFERENCES ic_control_tests(id),
  evidence_type text CHECK (evidence_type IN ('document', 'screenshot', 'report', 'approval', 'log', 'other')) DEFAULT 'document',
  evidence_name text NOT NULL,
  evidence_url text,
  description text,
  uploaded_by uuid REFERENCES profiles(id),
  uploaded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ic_evidences_org ON ic_control_evidences(organization_id);
CREATE INDEX idx_ic_evidences_control ON ic_control_evidences(control_id);

ALTER TABLE ic_control_evidences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evidences in their org"
  ON ic_control_evidences FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can upload evidences"
  ON ic_control_evidences FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- 14. BULGULAR
-- ============================================================================

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

CREATE INDEX idx_ic_findings_org ON ic_findings(organization_id);
CREATE INDEX idx_ic_findings_control ON ic_findings(control_id);
CREATE INDEX idx_ic_findings_status ON ic_findings(status);

ALTER TABLE ic_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view findings in their org"
  ON ic_findings FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create findings"
  ON ic_findings FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- 15. DÖF (CAPA - Corrective and Preventive Actions)
-- ============================================================================

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

CREATE INDEX idx_ic_capas_org ON ic_capas(organization_id);
CREATE INDEX idx_ic_capas_finding ON ic_capas(finding_id);
CREATE INDEX idx_ic_capas_responsible ON ic_capas(responsible_user_id);
CREATE INDEX idx_ic_capas_status ON ic_capas(status);
CREATE INDEX idx_ic_capas_due_date ON ic_capas(due_date);

ALTER TABLE ic_capas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view CAPAs in their org"
  ON ic_capas FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can create CAPAs"
  ON ic_capas FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

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

-- ============================================================================
-- 16. DÖF AKSİYONLARI (İlerleme Kayıtları)
-- ============================================================================

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

CREATE INDEX idx_ic_capa_actions_org ON ic_capa_actions(organization_id);
CREATE INDEX idx_ic_capa_actions_capa ON ic_capa_actions(capa_id);

ALTER TABLE ic_capa_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view CAPA actions in their org"
  ON ic_capa_actions FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can add CAPA actions"
  ON ic_capa_actions FOR INSERT
  TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- 17. SÜREÇ-KİKS EŞLEŞTİRMELERİ
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_process_kiks_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  process_id uuid REFERENCES ic_processes(id) ON DELETE CASCADE,
  risk_id uuid REFERENCES ic_risks(id) ON DELETE CASCADE,
  control_id uuid REFERENCES ic_controls(id) ON DELETE CASCADE,
  kiks_standard_id uuid NOT NULL REFERENCES ic_kiks_standards(id) ON DELETE CASCADE,
  mapping_type text CHECK (mapping_type IN ('process', 'risk', 'control')) NOT NULL,
  compliance_level text CHECK (compliance_level IN ('not_compliant', 'partially_compliant', 'compliant', 'fully_compliant')) DEFAULT 'not_compliant',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ic_pk_mappings_org ON ic_process_kiks_mappings(organization_id);
CREATE INDEX idx_ic_pk_mappings_process ON ic_process_kiks_mappings(process_id);
CREATE INDEX idx_ic_pk_mappings_kiks ON ic_process_kiks_mappings(kiks_standard_id);

ALTER TABLE ic_process_kiks_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view KİKS mappings in their org"
  ON ic_process_kiks_mappings FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage KİKS mappings"
  ON ic_process_kiks_mappings FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- 18. RİSK-HEDEF EŞLEŞTİRMELERİ (5018 Entegrasyonu)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_risk_goal_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  risk_id uuid NOT NULL REFERENCES ic_risks(id) ON DELETE CASCADE,
  goal_id uuid REFERENCES goals(id) ON DELETE CASCADE,
  impact_level text CHECK (impact_level IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ic_rg_mappings_org ON ic_risk_goal_mappings(organization_id);
CREATE INDEX idx_ic_rg_mappings_risk ON ic_risk_goal_mappings(risk_id);
CREATE INDEX idx_ic_rg_mappings_goal ON ic_risk_goal_mappings(goal_id);

ALTER TABLE ic_risk_goal_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risk-goal mappings in their org"
  ON ic_risk_goal_mappings FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can manage risk-goal mappings"
  ON ic_risk_goal_mappings FOR ALL
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

-- ============================================================================
-- 19. AUDIT LOGLARI
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ic_audit_org ON ic_audit_logs(organization_id);
CREATE INDEX idx_ic_audit_user ON ic_audit_logs(user_id);
CREATE INDEX idx_ic_audit_entity ON ic_audit_logs(entity_type, entity_id);
CREATE INDEX idx_ic_audit_created ON ic_audit_logs(created_at);

ALTER TABLE ic_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit logs"
  ON ic_audit_logs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- ============================================================================
-- 20. FOREIGN KEY EKLEMELERİ (Deferred)
-- ============================================================================

-- RACI Matrix için process ve process_step foreign key'leri sonradan eklenecek
-- çünkü circular dependency var

-- ============================================================================
-- 21. HELPER FONKSİYONLAR
-- ============================================================================

-- KİKS Uyum Skoru Hesaplama Fonksiyonu
CREATE OR REPLACE FUNCTION calculate_kiks_compliance_score(org_id uuid)
RETURNS numeric AS $$
DECLARE
  total_standards integer;
  mapped_standards integer;
  compliance_score numeric;
BEGIN
  -- Toplam KİKS standart sayısı
  SELECT COUNT(*) INTO total_standards
  FROM ic_kiks_standards
  WHERE organization_id = org_id;

  -- Eşleştirilmiş standart sayısı
  SELECT COUNT(DISTINCT kiks_standard_id) INTO mapped_standards
  FROM ic_process_kiks_mappings
  WHERE organization_id = org_id
    AND compliance_level IN ('compliant', 'fully_compliant');

  -- Uyum skoru hesapla
  IF total_standards > 0 THEN
    compliance_score := (mapped_standards::numeric / total_standards::numeric) * 100;
  ELSE
    compliance_score := 0;
  END IF;

  RETURN ROUND(compliance_score, 2);
END;
$$ LANGUAGE plpgsql;

-- Kontrol Olgunluk Puanı Hesaplama Fonksiyonu
CREATE OR REPLACE FUNCTION calculate_control_maturity_score(org_id uuid)
RETURNS jsonb AS $$
DECLARE
  design_effective integer;
  design_total integer;
  operating_effective integer;
  operating_total integer;
  coverage_ratio numeric;
  result jsonb;
BEGIN
  -- Tasarım etkinliği
  SELECT
    COUNT(*) FILTER (WHERE design_effectiveness = 'effective'),
    COUNT(*)
  INTO design_effective, design_total
  FROM ic_controls
  WHERE organization_id = org_id
    AND status = 'active';

  -- İşletim etkinliği
  SELECT
    COUNT(*) FILTER (WHERE operating_effectiveness = 'effective'),
    COUNT(*)
  INTO operating_effective, operating_total
  FROM ic_controls
  WHERE organization_id = org_id
    AND status = 'active';

  -- Kapsam oranı (kontroller / riskler)
  SELECT
    CASE
      WHEN COUNT(DISTINCT r.id) > 0
      THEN (COUNT(DISTINCT c.id)::numeric / COUNT(DISTINCT r.id)::numeric) * 100
      ELSE 0
    END
  INTO coverage_ratio
  FROM ic_risks r
  LEFT JOIN ic_controls c ON c.risk_id = r.id
  WHERE r.organization_id = org_id;

  result := jsonb_build_object(
    'design_effectiveness_pct', CASE WHEN design_total > 0 THEN ROUND((design_effective::numeric / design_total::numeric) * 100, 2) ELSE 0 END,
    'operating_effectiveness_pct', CASE WHEN operating_total > 0 THEN ROUND((operating_effective::numeric / operating_total::numeric) * 100, 2) ELSE 0 END,
    'coverage_ratio_pct', ROUND(coverage_ratio, 2),
    'overall_maturity_score', CASE WHEN design_total > 0 AND operating_total > 0
      THEN ROUND(((design_effective::numeric / design_total::numeric) + (operating_effective::numeric / operating_total::numeric) + (coverage_ratio / 100)) / 3 * 100, 2)
      ELSE 0 END
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;


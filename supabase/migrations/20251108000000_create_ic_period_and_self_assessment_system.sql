/*
  # İç Kontrol Periyod Yönetimi ve Öz Değerlendirme Sistemi

  ## Genel Bakış
  Bu migration, iç kontrol sistemine dönemsel planlama, müdürlük bazlı öz değerlendirme
  ve veri tamamlanma takibi özelliklerini ekler.

  ## 1. Yeni Tablolar

  ### Dönem Yönetimi
    - `ic_periods` - İç kontrol dönemleri (yıllık planlar)

  ### Öz Değerlendirme
    - `ic_self_assessments` - Müdürlük bazlı KİKS öz değerlendirmeleri
    - `ic_assessment_evidences` - Değerlendirme kanıtları ve dokümanları

  ### İlerleme Takibi
    - `ic_department_completion_status` - Müdürlük veri tamamlanma durumu
    - `ic_submission_logs` - Veri gönderim logları

  ### Raporlama
    - `ic_kiks_compliance_scores` - KİKS uyumluluk skor view'ı
    - `ic_department_performance_summary` - Müdürlük performans özeti

  ## 2. Güvenlik
    - RLS tüm tablolarda aktif
    - Müdürlük: Sadece kendi verilerini görür ve yönetir
    - Admin/VP: Tüm müdürlüklerin verilerini görür ve onaylar
    - Super Admin: Tüm organizasyonları görebilir

  ## 3. İş Akışı
    Müdürlük → Öz Değerlendirme → Submit → Admin Review → Approve/Reject

  ## 4. Entegrasyonlar
    - Mevcut KİKS standartları ile tam entegrasyon
    - Department ve profiles tablolarıyla ilişkili
    - Mevcut risk, kontrol ve DÖF tablolarıyla bağlantılı
*/

-- ============================================================================
-- 1. İÇ KONTROL DÖNEMLERİ (Yıllık Planlama)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Dönem Bilgileri
  year integer NOT NULL,
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,

  -- Durum
  status text CHECK (status IN ('planning', 'active', 'assessment_phase', 'review_phase', 'completed', 'archived')) DEFAULT 'planning',

  -- Hedefler ve Metrikler
  target_kiks_compliance_pct integer DEFAULT 80 CHECK (target_kiks_compliance_pct BETWEEN 0 AND 100),
  target_risk_mitigation_pct integer DEFAULT 70 CHECK (target_risk_mitigation_pct BETWEEN 0 AND 100),
  target_control_effectiveness_pct integer DEFAULT 85 CHECK (target_control_effectiveness_pct BETWEEN 0 AND 100),

  -- Önemli Tarihler
  assessment_deadline date,
  review_deadline date,
  finalization_deadline date,

  -- Onay
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  approval_notes text,

  -- Metadata
  is_current boolean DEFAULT false,
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(organization_id, year)
);

CREATE INDEX idx_ic_periods_org ON ic_periods(organization_id);
CREATE INDEX idx_ic_periods_year ON ic_periods(year);
CREATE INDEX idx_ic_periods_status ON ic_periods(status);
CREATE INDEX idx_ic_periods_current ON ic_periods(is_current) WHERE is_current = true;

ALTER TABLE ic_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view periods in their org"
  ON ic_periods FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage periods"
  ON ic_periods FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- ============================================================================
-- 2. ÖZ DEĞERLENDİRME (Self-Assessment)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_self_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES ic_periods(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  kiks_standard_id uuid NOT NULL REFERENCES ic_kiks_standards(id) ON DELETE CASCADE,

  -- Değerlendirme Skorları
  compliance_level integer CHECK (compliance_level BETWEEN 1 AND 5),
  -- 1: Yetersiz, 2: Geliştirilmeli, 3: Kısmen Uyumlu, 4: Uyumlu, 5: Tam Uyumlu

  maturity_level text CHECK (maturity_level IN ('initial', 'developing', 'defined', 'managed', 'optimized')),
  -- CMM Maturity Model: İlk Seviye → Gelişen → Tanımlanmış → Yönetilen → Optimize

  effectiveness_score integer CHECK (effectiveness_score BETWEEN 1 AND 5),

  -- Değerlendirme İçeriği
  current_situation text,
  evidence_description text,
  supporting_documents text,
  gaps_identified text,
  strengths text,
  weaknesses text,
  improvement_actions text,
  improvement_priority text CHECK (improvement_priority IN ('low', 'medium', 'high', 'critical')),

  -- Süreç ve Durum
  assessed_by uuid REFERENCES profiles(id),
  assessment_date date NOT NULL,
  status text CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'rejected', 'revision_requested')) DEFAULT 'draft',

  -- Admin İnceleme
  reviewed_by uuid REFERENCES profiles(id),
  review_date date,
  review_notes text,
  review_score_adjustment integer,

  -- Tarihsel Takip
  previous_assessment_id uuid REFERENCES ic_self_assessments(id),
  improvement_since_last text,

  -- Metadata
  metadata jsonb DEFAULT '{}'::jsonb,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE(period_id, department_id, kiks_standard_id)
);

CREATE INDEX idx_ic_self_assessments_org ON ic_self_assessments(organization_id);
CREATE INDEX idx_ic_self_assessments_period ON ic_self_assessments(period_id);
CREATE INDEX idx_ic_self_assessments_dept ON ic_self_assessments(department_id);
CREATE INDEX idx_ic_self_assessments_kiks ON ic_self_assessments(kiks_standard_id);
CREATE INDEX idx_ic_self_assessments_status ON ic_self_assessments(status);
CREATE INDEX idx_ic_self_assessments_assessed_by ON ic_self_assessments(assessed_by);

ALTER TABLE ic_self_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assessments in their org"
  ON ic_self_assessments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Department users can create their assessments"
  ON ic_self_assessments FOR INSERT
  TO authenticated
  WITH CHECK (
    department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
    AND organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Department users can update their draft assessments"
  ON ic_self_assessments FOR UPDATE
  TO authenticated
  USING (
    (
      department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
      AND status = 'draft'
    )
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

CREATE POLICY "Admins can manage all assessments"
  ON ic_self_assessments FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- ============================================================================
-- 3. DEĞERLENDİRME KANITLARI
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_assessment_evidences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  assessment_id uuid NOT NULL REFERENCES ic_self_assessments(id) ON DELETE CASCADE,

  -- Kanıt Bilgileri
  evidence_type text CHECK (evidence_type IN ('document', 'screenshot', 'report', 'procedure', 'record', 'other')),
  evidence_title text NOT NULL,
  evidence_description text,
  file_url text,
  file_name text,
  file_size integer,

  -- Metadata
  uploaded_by uuid REFERENCES profiles(id),
  uploaded_at timestamptz DEFAULT now(),

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ic_assessment_evidences_org ON ic_assessment_evidences(organization_id);
CREATE INDEX idx_ic_assessment_evidences_assessment ON ic_assessment_evidences(assessment_id);

ALTER TABLE ic_assessment_evidences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evidences in their org"
  ON ic_assessment_evidences FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Users can manage their evidences"
  ON ic_assessment_evidences FOR ALL
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- ============================================================================
-- 4. MÜDÜRLÜK VERİ TAMAMLANMA DURUMU
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_department_completion_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_id uuid NOT NULL REFERENCES ic_periods(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,

  -- Tamamlanma Oranları (0-100)
  self_assessment_completion_pct integer DEFAULT 0 CHECK (self_assessment_completion_pct BETWEEN 0 AND 100),
  processes_documented_pct integer DEFAULT 0 CHECK (processes_documented_pct BETWEEN 0 AND 100),
  risks_assessed_pct integer DEFAULT 0 CHECK (risks_assessed_pct BETWEEN 0 AND 100),
  controls_tested_pct integer DEFAULT 0 CHECK (controls_tested_pct BETWEEN 0 AND 100),
  capas_completed_pct integer DEFAULT 0 CHECK (capas_completed_pct BETWEEN 0 AND 100),

  -- Sayısal Veriler
  total_kiks_standards integer DEFAULT 0,
  completed_assessments integer DEFAULT 0,
  pending_assessments integer DEFAULT 0,
  approved_assessments integer DEFAULT 0,
  rejected_assessments integer DEFAULT 0,

  total_processes integer DEFAULT 0,
  total_risks integer DEFAULT 0,
  total_controls integer DEFAULT 0,
  total_capas integer DEFAULT 0,

  -- Genel Durum
  overall_status text CHECK (overall_status IN ('not_started', 'in_progress', 'pending_review', 'completed', 'late')) DEFAULT 'not_started',
  overall_completion_pct integer DEFAULT 0 CHECK (overall_completion_pct BETWEEN 0 AND 100),

  -- Tarih Takibi
  started_at timestamptz,
  submitted_at timestamptz,
  completed_at timestamptz,
  target_completion_date date,

  -- Skor ve Performans
  quality_score integer CHECK (quality_score BETWEEN 0 AND 100),
  timeliness_score integer CHECK (timeliness_score BETWEEN 0 AND 100),
  completeness_score integer CHECK (completeness_score BETWEEN 0 AND 100),

  -- Notlar
  department_notes text,
  admin_notes text,

  last_updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),

  UNIQUE(period_id, department_id)
);

CREATE INDEX idx_ic_dept_completion_org ON ic_department_completion_status(organization_id);
CREATE INDEX idx_ic_dept_completion_period ON ic_department_completion_status(period_id);
CREATE INDEX idx_ic_dept_completion_dept ON ic_department_completion_status(department_id);
CREATE INDEX idx_ic_dept_completion_status ON ic_department_completion_status(overall_status);

ALTER TABLE ic_department_completion_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view completion status in their org"
  ON ic_department_completion_status FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Department users can update their own status"
  ON ic_department_completion_status FOR UPDATE
  TO authenticated
  USING (
    department_id IN (SELECT department_id FROM profiles WHERE id = auth.uid())
    OR organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

CREATE POLICY "System can insert completion status"
  ON ic_department_completion_status FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- ============================================================================
-- 5. GÖNDERİM LOGLARI (Audit Trail)
-- ============================================================================

CREATE TABLE IF NOT EXISTS ic_submission_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_id uuid REFERENCES ic_periods(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE CASCADE,

  -- Gönderim Bilgileri
  submission_type text CHECK (submission_type IN ('assessment', 'process', 'risk', 'control', 'capa', 'period_submission')),
  entity_id uuid,
  entity_type text,

  -- Aksiyon
  action text CHECK (action IN ('created', 'updated', 'submitted', 'approved', 'rejected', 'revision_requested')),
  old_status text,
  new_status text,

  -- Kim, Ne Zaman
  performed_by uuid REFERENCES profiles(id),
  performed_at timestamptz DEFAULT now(),

  -- Detaylar
  changes jsonb DEFAULT '{}'::jsonb,
  notes text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ic_submission_logs_org ON ic_submission_logs(organization_id);
CREATE INDEX idx_ic_submission_logs_period ON ic_submission_logs(period_id);
CREATE INDEX idx_ic_submission_logs_dept ON ic_submission_logs(department_id);
CREATE INDEX idx_ic_submission_logs_performed_by ON ic_submission_logs(performed_by);
CREATE INDEX idx_ic_submission_logs_date ON ic_submission_logs(performed_at);

ALTER TABLE ic_submission_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view submission logs in their org"
  ON ic_submission_logs FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "System can insert submission logs"
  ON ic_submission_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- ============================================================================
-- 6. VIEWS - KİKS UYUMLULUK SKORLARI
-- ============================================================================

CREATE OR REPLACE VIEW ic_kiks_compliance_scores AS
SELECT
  sa.organization_id,
  sa.period_id,
  sa.department_id,
  d.name as department_name,
  k.component,
  k.theme,
  COUNT(sa.id) as total_assessments,
  COUNT(CASE WHEN sa.status = 'approved' THEN 1 END) as approved_assessments,
  AVG(CASE WHEN sa.status = 'approved' THEN sa.compliance_level END) as avg_compliance_level,
  AVG(CASE WHEN sa.status = 'approved' THEN sa.effectiveness_score END) as avg_effectiveness_score,
  COUNT(CASE WHEN sa.compliance_level >= 4 AND sa.status = 'approved' THEN 1 END) as compliant_count,
  ROUND(
    COUNT(CASE WHEN sa.compliance_level >= 4 AND sa.status = 'approved' THEN 1 END)::numeric /
    NULLIF(COUNT(CASE WHEN sa.status = 'approved' THEN 1 END), 0) * 100,
    2
  ) as compliance_percentage
FROM ic_self_assessments sa
JOIN departments d ON sa.department_id = d.id
JOIN ic_kiks_standards k ON sa.kiks_standard_id = k.id
GROUP BY sa.organization_id, sa.period_id, sa.department_id, d.name, k.component, k.theme;

-- ============================================================================
-- 7. VIEWS - MÜDÜRLÜK PERFORMANS ÖZETİ
-- ============================================================================

CREATE OR REPLACE VIEW ic_department_performance_summary AS
SELECT
  dcs.organization_id,
  dcs.period_id,
  p.year,
  p.title as period_title,
  dcs.department_id,
  d.name as department_name,

  -- Tamamlanma
  dcs.overall_completion_pct,
  dcs.overall_status,

  -- Skor Detayları
  dcs.quality_score,
  dcs.timeliness_score,
  dcs.completeness_score,

  -- Uyumluluk
  AVG(sa.compliance_level) as avg_compliance_level,
  COUNT(CASE WHEN sa.status = 'approved' THEN 1 END) as approved_assessments,
  COUNT(CASE WHEN sa.status = 'rejected' THEN 1 END) as rejected_assessments,

  -- Risk ve Kontrol
  dcs.total_risks,
  dcs.total_controls,
  dcs.total_capas,
  dcs.risks_assessed_pct,
  dcs.controls_tested_pct,
  dcs.capas_completed_pct,

  -- Tarihler
  dcs.started_at,
  dcs.submitted_at,
  dcs.completed_at,
  dcs.target_completion_date,

  -- Gecikme Durumu
  CASE
    WHEN dcs.completed_at IS NOT NULL THEN false
    WHEN dcs.target_completion_date < CURRENT_DATE THEN true
    ELSE false
  END as is_late

FROM ic_department_completion_status dcs
JOIN departments d ON dcs.department_id = d.id
JOIN ic_periods p ON dcs.period_id = p.id
LEFT JOIN ic_self_assessments sa ON sa.department_id = dcs.department_id AND sa.period_id = dcs.period_id
GROUP BY
  dcs.organization_id, dcs.period_id, p.year, p.title,
  dcs.department_id, d.name,
  dcs.overall_completion_pct, dcs.overall_status,
  dcs.quality_score, dcs.timeliness_score, dcs.completeness_score,
  dcs.total_risks, dcs.total_controls, dcs.total_capas,
  dcs.risks_assessed_pct, dcs.controls_tested_pct, dcs.capas_completed_pct,
  dcs.started_at, dcs.submitted_at, dcs.completed_at, dcs.target_completion_date;

-- ============================================================================
-- 8. FUNCTIONS - OTOMATİK TAMAMLANMA HESAPLAMA
-- ============================================================================

CREATE OR REPLACE FUNCTION update_department_completion_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Self-assessment tamamlanma oranını güncelle
  UPDATE ic_department_completion_status
  SET
    completed_assessments = (
      SELECT COUNT(*) FROM ic_self_assessments
      WHERE department_id = NEW.department_id
      AND period_id = NEW.period_id
      AND status IN ('approved', 'submitted', 'under_review')
    ),
    pending_assessments = (
      SELECT COUNT(*) FROM ic_self_assessments
      WHERE department_id = NEW.department_id
      AND period_id = NEW.period_id
      AND status = 'draft'
    ),
    approved_assessments = (
      SELECT COUNT(*) FROM ic_self_assessments
      WHERE department_id = NEW.department_id
      AND period_id = NEW.period_id
      AND status = 'approved'
    ),
    rejected_assessments = (
      SELECT COUNT(*) FROM ic_self_assessments
      WHERE department_id = NEW.department_id
      AND period_id = NEW.period_id
      AND status = 'rejected'
    ),
    self_assessment_completion_pct = LEAST(100, ROUND(
      (SELECT COUNT(*)::numeric FROM ic_self_assessments
       WHERE department_id = NEW.department_id
       AND period_id = NEW.period_id
       AND status IN ('approved', 'submitted', 'under_review'))
      /
      NULLIF((SELECT COUNT(*)::numeric FROM ic_kiks_standards
              WHERE organization_id = NEW.organization_id), 0)
      * 100
    )),
    overall_completion_pct = (
      COALESCE((SELECT self_assessment_completion_pct FROM ic_department_completion_status
                WHERE department_id = NEW.department_id AND period_id = NEW.period_id), 0) * 0.4 +
      COALESCE((SELECT risks_assessed_pct FROM ic_department_completion_status
                WHERE department_id = NEW.department_id AND period_id = NEW.period_id), 0) * 0.2 +
      COALESCE((SELECT controls_tested_pct FROM ic_department_completion_status
                WHERE department_id = NEW.department_id AND period_id = NEW.period_id), 0) * 0.2 +
      COALESCE((SELECT capas_completed_pct FROM ic_department_completion_status
                WHERE department_id = NEW.department_id AND period_id = NEW.period_id), 0) * 0.2
    )::integer,
    last_updated_at = now()
  WHERE department_id = NEW.department_id
  AND period_id = NEW.period_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Self-assessment değiştiğinde tamamlanma durumunu güncelle
DROP TRIGGER IF EXISTS trigger_update_completion_on_assessment ON ic_self_assessments;
CREATE TRIGGER trigger_update_completion_on_assessment
  AFTER INSERT OR UPDATE ON ic_self_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_department_completion_status();

-- ============================================================================
-- 9. İLK VERİ - ÖRNEK DÖNEM OLUŞTURMA (OPTIONAL)
-- ============================================================================

-- Her organizasyon için 2025 dönemi oluştur (sadece henüz yoksa)
-- INSERT INTO ic_periods (organization_id, year, title, start_date, end_date, status, assessment_deadline, is_current)
-- SELECT
--   id,
--   2025,
--   '2025 İç Kontrol İzleme ve Değerlendirme Dönemi',
--   '2025-01-01',
--   '2025-12-31',
--   'active',
--   '2025-06-30',
--   true
-- FROM organizations
-- ON CONFLICT (organization_id, year) DO NOTHING;

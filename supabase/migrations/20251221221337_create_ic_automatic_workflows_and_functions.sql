/*
  # İç Kontrol Otomatik Akışları ve İş Kuralları

  1. Yeni Tablolar
    - `ic_monitoring_evaluations` - İzleme ve değerlendirme kayıtları
    - `ic_institutional_framework` - Kurumsal çerçeve (stratejik amaçlar, organizasyon yapısı)
    - `ic_automatic_action_queue` - Otomatik eylem kuyruğu

  2. Database Functions
    - `check_risk_needs_control()` - Risk kontrol ihtiyacını kontrol eder
    - `auto_create_action_for_high_risk()` - Yüksek riskler için otomatik eylem oluşturur
    - `auto_create_capa_for_failed_control()` - Başarısız kontroller için DÖF oluşturur
    - `update_risk_residual_score()` - Risk artık skorunu günceller
    - `calculate_kiks_compliance()` - KİKS uyum oranını hesaplar

  3. Triggers
    - Risk eklendiğinde veya güncellendiğinde kontrol varlığını kontrol et
    - Kontrol testi başarısız olduğunda DÖF oluştur
    - CAPA kapatıldığında risk durumunu güncelle

  4. Views
    - `vw_ic_integrated_risk_report` - Entegre risk raporu görünümü
    - `vw_ic_kiks_compliance_summary` - KİKS uyum özeti
    - `vw_ic_control_effectiveness` - Kontrol etkinlik raporu
*/

-- İZLEME VE DEĞERLENDİRME
CREATE TABLE IF NOT EXISTS ic_monitoring_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE,
  evaluation_period text NOT NULL,
  evaluation_date date NOT NULL DEFAULT CURRENT_DATE,
  evaluated_by uuid REFERENCES profiles(id),
  department_id uuid REFERENCES departments(id),
  
  -- Süreç Değerlendirmesi
  total_processes integer DEFAULT 0,
  active_processes integer DEFAULT 0,
  processes_with_issues integer DEFAULT 0,
  
  -- Risk Değerlendirmesi
  total_risks integer DEFAULT 0,
  high_risks integer DEFAULT 0,
  risks_with_controls integer DEFAULT 0,
  risks_without_controls integer DEFAULT 0,
  
  -- Kontrol Değerlendirmesi
  total_controls integer DEFAULT 0,
  effective_controls integer DEFAULT 0,
  ineffective_controls integer DEFAULT 0,
  controls_not_tested integer DEFAULT 0,
  
  -- Eylem Planları
  total_action_plans integer DEFAULT 0,
  completed_action_plans integer DEFAULT 0,
  delayed_action_plans integer DEFAULT 0,
  
  -- DÖF/CAPA
  total_capas integer DEFAULT 0,
  open_capas integer DEFAULT 0,
  overdue_capas integer DEFAULT 0,
  
  -- KİKS Uyumu
  kiks_compliance_percentage numeric(5,2),
  
  -- Genel Değerlendirme
  overall_status text CHECK (overall_status IN ('excellent', 'good', 'fair', 'poor')),
  key_findings text,
  recommendations text,
  action_items text,
  
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_monitoring_org ON ic_monitoring_evaluations(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_monitoring_plan ON ic_monitoring_evaluations(ic_plan_id);
CREATE INDEX IF NOT EXISTS idx_ic_monitoring_dept ON ic_monitoring_evaluations(department_id);
CREATE INDEX IF NOT EXISTS idx_ic_monitoring_date ON ic_monitoring_evaluations(evaluation_date);

ALTER TABLE ic_monitoring_evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view monitoring evaluations in their org"
  ON ic_monitoring_evaluations FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage monitoring evaluations"
  ON ic_monitoring_evaluations FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- KURUMSAL ÇERÇEVE
CREATE TABLE IF NOT EXISTS ic_institutional_framework (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE,
  
  framework_type text CHECK (framework_type IN ('strategic_goal', 'organizational_structure', 'authority_delegation', 'policy', 'standard')) NOT NULL,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  
  -- Stratejik Amaç için
  parent_id uuid REFERENCES ic_institutional_framework(id),
  responsible_department_id uuid REFERENCES departments(id),
  
  -- Politika/Standart için
  approval_status text CHECK (approval_status IN ('draft', 'approved', 'active', 'archived')) DEFAULT 'draft',
  approved_by uuid REFERENCES profiles(id),
  approved_at timestamptz,
  effective_date date,
  review_date date,
  
  -- Yetki Devri için
  delegator_id uuid REFERENCES profiles(id),
  delegate_id uuid REFERENCES profiles(id),
  delegation_scope text,
  
  order_index integer DEFAULT 0,
  is_active boolean DEFAULT true,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(organization_id, framework_type, code)
);

CREATE INDEX IF NOT EXISTS idx_ic_framework_org ON ic_institutional_framework(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_framework_plan ON ic_institutional_framework(ic_plan_id);
CREATE INDEX IF NOT EXISTS idx_ic_framework_type ON ic_institutional_framework(framework_type);
CREATE INDEX IF NOT EXISTS idx_ic_framework_parent ON ic_institutional_framework(parent_id);

ALTER TABLE ic_institutional_framework ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view institutional framework in their org"
  ON ic_institutional_framework FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage institutional framework"
  ON ic_institutional_framework FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- OTOMATİK EYLEM KUYRUĞU
CREATE TABLE IF NOT EXISTS ic_automatic_action_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ic_plan_id uuid REFERENCES ic_plans(id) ON DELETE CASCADE,
  
  action_type text CHECK (action_type IN ('create_action_plan', 'create_capa', 'update_risk', 'send_notification')) NOT NULL,
  trigger_source text CHECK (trigger_source IN ('high_risk', 'no_control', 'failed_test', 'overdue_action', 'capa_closed')) NOT NULL,
  
  -- Kaynak nesneler
  risk_id uuid REFERENCES ic_risks(id),
  control_id uuid REFERENCES ic_controls(id),
  control_test_id uuid REFERENCES ic_control_tests(id),
  action_plan_id uuid REFERENCES ic_action_plans(id),
  capa_id uuid REFERENCES ic_capas(id),
  
  status text CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
  priority integer DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  
  action_data jsonb DEFAULT '{}'::jsonb,
  result_data jsonb,
  error_message text,
  
  scheduled_at timestamptz DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ic_auto_queue_org ON ic_automatic_action_queue(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_auto_queue_status ON ic_automatic_action_queue(status);
CREATE INDEX IF NOT EXISTS idx_ic_auto_queue_type ON ic_automatic_action_queue(action_type);
CREATE INDEX IF NOT EXISTS idx_ic_auto_queue_scheduled ON ic_automatic_action_queue(scheduled_at);

ALTER TABLE ic_automatic_action_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view automatic action queue"
  ON ic_automatic_action_queue FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

-- FUNCTION: Yüksek risk için otomatik eylem oluştur
CREATE OR REPLACE FUNCTION auto_suggest_action_for_high_risk()
RETURNS TRIGGER AS $$
DECLARE
  v_control_count integer;
  v_queue_id uuid;
BEGIN
  -- Sadece yüksek veya kritik riskler için (skor >= 15)
  IF NEW.inherent_score >= 15 OR NEW.residual_score >= 15 THEN
    -- Bu risk için kaç kontrol var?
    SELECT COUNT(*) INTO v_control_count
    FROM ic_controls
    WHERE risk_id = NEW.id AND status = 'active';
    
    -- Eğer kontrol yoksa veya yetersizse, otomatik eylem kuyruğuna ekle
    IF v_control_count = 0 THEN
      INSERT INTO ic_automatic_action_queue (
        organization_id,
        ic_plan_id,
        action_type,
        trigger_source,
        risk_id,
        priority,
        action_data
      ) VALUES (
        NEW.organization_id,
        NEW.ic_plan_id,
        'create_action_plan',
        'high_risk',
        NEW.id,
        CASE 
          WHEN NEW.inherent_score >= 20 THEN 10
          WHEN NEW.inherent_score >= 15 THEN 8
          ELSE 5
        END,
        jsonb_build_object(
          'risk_code', NEW.risk_code,
          'risk_title', NEW.risk_title,
          'inherent_score', NEW.inherent_score,
          'residual_score', NEW.residual_score,
          'suggested_action', 'Yüksek risk tespit edildi. Kontrol faaliyeti tanımlanmalıdır.',
          'control_count', v_control_count
        )
      )
      RETURNING id INTO v_queue_id;
      
      -- Risk metadata'ya kaydet
      NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb) || 
                     jsonb_build_object(
                       'auto_action_suggested', true,
                       'action_queue_id', v_queue_id,
                       'suggestion_date', now()
                     );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGER: Risk eklendiğinde veya güncellendiğinde
DROP TRIGGER IF EXISTS trigger_auto_suggest_action_for_risk ON ic_risks;
CREATE TRIGGER trigger_auto_suggest_action_for_risk
  BEFORE INSERT OR UPDATE OF inherent_score, residual_score ON ic_risks
  FOR EACH ROW
  EXECUTE FUNCTION auto_suggest_action_for_high_risk();

-- FUNCTION: Başarısız kontrol testi için DÖF öner
CREATE OR REPLACE FUNCTION auto_suggest_capa_for_failed_test()
RETURNS TRIGGER AS $$
DECLARE
  v_control_code text;
  v_control_title text;
  v_risk_id uuid;
BEGIN
  -- Sadece başarısız testler için
  IF NEW.test_result IN ('fail', 'pass_with_exceptions') AND NEW.exceptions_found > 0 THEN
    -- Kontrol bilgilerini al
    SELECT control_code, control_title, risk_id
    INTO v_control_code, v_control_title, v_risk_id
    FROM ic_controls
    WHERE id = NEW.control_id;
    
    -- Otomatik DÖF kuyruğuna ekle
    INSERT INTO ic_automatic_action_queue (
      organization_id,
      ic_plan_id,
      action_type,
      trigger_source,
      control_id,
      control_test_id,
      risk_id,
      priority,
      action_data
    ) VALUES (
      NEW.organization_id,
      NEW.ic_plan_id,
      'create_capa',
      'failed_test',
      NEW.control_id,
      NEW.id,
      v_risk_id,
      CASE 
        WHEN NEW.test_result = 'fail' THEN 9
        ELSE 6
      END,
      jsonb_build_object(
        'control_code', v_control_code,
        'control_title', v_control_title,
        'test_date', NEW.test_date,
        'test_result', NEW.test_result,
        'exceptions_found', NEW.exceptions_found,
        'test_notes', NEW.test_notes,
        'suggested_title', 'Kontrol Testi Başarısız: ' || v_control_title,
        'suggested_description', format('Kontrol testi %s tarihinde gerçekleştirildi. %s adet uygunsuzluk tespit edildi.', 
                                       NEW.test_date, NEW.exceptions_found)
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGER: Kontrol testi eklendiğinde
DROP TRIGGER IF EXISTS trigger_auto_suggest_capa_for_test ON ic_control_tests;
CREATE TRIGGER trigger_auto_suggest_capa_for_test
  AFTER INSERT OR UPDATE OF test_result ON ic_control_tests
  FOR EACH ROW
  EXECUTE FUNCTION auto_suggest_capa_for_failed_test();

-- FUNCTION: CAPA kapandığında risk ve kontrol durumunu güncelle
CREATE OR REPLACE FUNCTION update_risk_after_capa_closure()
RETURNS TRIGGER AS $$
DECLARE
  v_finding_risk_id uuid;
  v_finding_control_id uuid;
BEGIN
  -- Sadece CAPA kapatıldığında veya doğrulandığında
  IF NEW.status IN ('verified', 'closed') AND OLD.status NOT IN ('verified', 'closed') THEN
    -- İlgili bulgudan risk ve kontrol ID'lerini al
    IF NEW.finding_id IS NOT NULL THEN
      SELECT risk_id, control_id
      INTO v_finding_risk_id, v_finding_control_id
      FROM ic_findings
      WHERE id = NEW.finding_id;
      
      -- Bulgu durumunu güncelle
      UPDATE ic_findings
      SET status = 'resolved',
          updated_at = now()
      WHERE id = NEW.finding_id;
      
      -- Kontrol etkinliğini güncelle
      IF v_finding_control_id IS NOT NULL THEN
        UPDATE ic_controls
        SET operating_effectiveness = 'effective',
            updated_at = now(),
            metadata = COALESCE(metadata, '{}'::jsonb) || 
                      jsonb_build_object(
                        'last_capa_resolution', now(),
                        'capa_id', NEW.id
                      )
        WHERE id = v_finding_control_id;
      END IF;
      
      -- Risk durumunu güncelle
      IF v_finding_risk_id IS NOT NULL THEN
        UPDATE ic_risks
        SET status = 'monitored',
            next_review_date = CURRENT_DATE + INTERVAL '3 months',
            updated_at = now(),
            metadata = COALESCE(metadata, '{}'::jsonb) || 
                      jsonb_build_object(
                        'last_capa_resolution', now(),
                        'capa_id', NEW.id
                      )
        WHERE id = v_finding_risk_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- TRIGGER: CAPA durumu güncellendiğinde
DROP TRIGGER IF EXISTS trigger_update_risk_after_capa ON ic_capas;
CREATE TRIGGER trigger_update_risk_after_capa
  AFTER UPDATE OF status ON ic_capas
  FOR EACH ROW
  EXECUTE FUNCTION update_risk_after_capa_closure();

-- VIEW: Entegre Risk Raporu
CREATE OR REPLACE VIEW vw_ic_integrated_risk_report AS
SELECT 
  r.id as risk_id,
  r.organization_id,
  r.ic_plan_id,
  p.name as process_name,
  p.code as process_code,
  p.department_id,
  d.name as department_name,
  r.risk_code,
  r.risk_title,
  r.risk_category,
  r.inherent_likelihood,
  r.inherent_impact,
  r.inherent_score,
  r.residual_likelihood,
  r.residual_impact,
  r.residual_score,
  r.status as risk_status,
  
  -- Kontroller
  (SELECT COUNT(*) FROM ic_controls WHERE risk_id = r.id AND status = 'active') as control_count,
  (SELECT COUNT(*) FROM ic_controls WHERE risk_id = r.id AND status = 'active' AND operating_effectiveness = 'effective') as effective_control_count,
  
  -- Bulgular
  (SELECT COUNT(*) FROM ic_findings WHERE risk_id = r.id AND status IN ('open', 'in_progress')) as open_findings_count,
  
  -- CAPA
  (SELECT COUNT(*) 
   FROM ic_capas c
   JOIN ic_findings f ON c.finding_id = f.id
   WHERE f.risk_id = r.id AND c.status IN ('open', 'in_progress')) as open_capa_count,
   
  -- Eylem Planları (risk ile ilişkili)
  (SELECT COUNT(*) 
   FROM ic_action_plans ap
   WHERE ap.metadata->>'risk_id' = r.id::text AND ap.status IN ('planned', 'in_progress')) as open_action_count,
   
  -- KİKS etiketleri
  (SELECT array_agg(DISTINCT kms.code)
   FROM ic_process_kiks_mappings pkm
   JOIN ic_kiks_main_standards kms ON pkm.kiks_standard_id = kms.id
   WHERE pkm.process_id = p.id) as kiks_codes,
   
  r.created_at,
  r.updated_at,
  r.last_assessment_date,
  r.next_review_date
FROM ic_risks r
LEFT JOIN ic_processes p ON r.process_id = p.id
LEFT JOIN departments d ON p.department_id = d.id;

-- VIEW: KİKS Uyum Özeti
CREATE OR REPLACE VIEW vw_ic_kiks_compliance_summary AS
SELECT 
  kms.organization_id,
  kc.code as category_code,
  kc.name as category_name,
  kms.code as standard_code,
  kms.title as standard_title,
  
  -- Alt standartlar
  COUNT(DISTINCT kss.id) as total_sub_standards,
  
  -- Eylemler
  COUNT(DISTINCT ka.id) as total_actions,
  COUNT(DISTINCT ka.id) FILTER (WHERE ka.status = 'completed') as completed_actions,
  COUNT(DISTINCT ka.id) FILTER (WHERE ka.status IN ('not_started', 'delayed')) as pending_actions,
  
  -- Uyum yüzdesi
  CASE 
    WHEN COUNT(DISTINCT ka.id) > 0 THEN
      ROUND((COUNT(DISTINCT ka.id) FILTER (WHERE ka.status = 'completed')::numeric / 
             COUNT(DISTINCT ka.id)::numeric * 100), 2)
    ELSE 0
  END as compliance_percentage,
  
  -- Süreç bağlantıları
  (SELECT COUNT(DISTINCT process_id)
   FROM ic_process_kiks_mappings
   WHERE kiks_standard_id = kms.id) as linked_process_count

FROM ic_kiks_main_standards kms
JOIN ic_kiks_categories kc ON kms.category_id = kc.id
LEFT JOIN ic_kiks_sub_standards kss ON kss.main_standard_id = kms.id
LEFT JOIN ic_kiks_actions ka ON ka.sub_standard_id = kss.id
GROUP BY kms.organization_id, kc.code, kc.name, kms.id, kms.code, kms.title;

-- VIEW: Kontrol Etkinlik Raporu
CREATE OR REPLACE VIEW vw_ic_control_effectiveness AS
SELECT 
  c.id as control_id,
  c.organization_id,
  c.ic_plan_id,
  c.control_code,
  c.control_title,
  c.control_type,
  c.control_nature,
  c.frequency,
  c.design_effectiveness,
  c.operating_effectiveness,
  c.status,
  
  p.name as process_name,
  r.risk_code,
  r.risk_title,
  r.risk_category,
  r.residual_score,
  
  -- Test sonuçları
  (SELECT COUNT(*) FROM ic_control_tests WHERE control_id = c.id) as total_tests,
  (SELECT COUNT(*) FROM ic_control_tests WHERE control_id = c.id AND test_result = 'pass') as passed_tests,
  (SELECT COUNT(*) FROM ic_control_tests WHERE control_id = c.id AND test_result = 'fail') as failed_tests,
  (SELECT MAX(test_date) FROM ic_control_tests WHERE control_id = c.id) as last_test_date,
  
  -- Test başarı oranı
  CASE 
    WHEN (SELECT COUNT(*) FROM ic_control_tests WHERE control_id = c.id) > 0 THEN
      ROUND((SELECT COUNT(*)::numeric FROM ic_control_tests WHERE control_id = c.id AND test_result = 'pass') / 
            (SELECT COUNT(*)::numeric FROM ic_control_tests WHERE control_id = c.id) * 100, 2)
    ELSE NULL
  END as test_success_rate,
  
  -- Bulgular
  (SELECT COUNT(*) 
   FROM ic_findings 
   WHERE control_id = c.id AND status IN ('open', 'in_progress')) as open_findings_count,
   
  c.created_at,
  c.updated_at

FROM ic_controls c
LEFT JOIN ic_processes p ON c.process_id = p.id
LEFT JOIN ic_risks r ON c.risk_id = r.id;
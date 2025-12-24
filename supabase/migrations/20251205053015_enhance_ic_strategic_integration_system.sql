/*
  # İç Kontrol ve Stratejik Plan Tam Entegrasyonu
  
  ## Amaç
  KIKS Standartları, Risk Yönetimi, Süreç Yönetimi, Faaliyet Yönetimi ve Kontrol Faaliyetleri arasında 
  tam entegrasyon sağlayarak düzgün bir eylem planı (CAPA) oluşturulmasını mümkün kılar.

  ## 1. Yeni İlişki Tabloları
  
  ### `ic_activity_process_mappings`
  Stratejik faaliyetler ile iç kontrol süreçleri arasında ilişki
  
  ### `ic_activity_risk_mappings` 
  Stratejik faaliyetler ile iç kontrol riskleri arasında ilişki
  
  ### `ic_activity_control_mappings`
  Stratejik faaliyetler ile kontrol faaliyetleri arasında ilişki
  
  ## 2. Tablo Güncellemeleri
  
  ### `ic_action_plans` tablosuna eklenenler:
  - `activity_id`: İlişkili stratejik faaliyet
  - `risk_id`: İlişkili risk
  - `control_id`: İlişkili kontrol
  - `finding_id`: İlişkili bulgu
  - `capa_id`: İlişkili CAPA kaydı
  
  ### `ic_capas` tablosuna eklenenler:
  - `activity_id`: İlişkili stratejik faaliyet
  - `process_id`: İlişkili süreç
  - `kiks_standard_id`: İlişkili KIKS standardı
  
  ## 3. Güvenlik
  - Tüm tablolar için RLS politikaları
  - Organization bazlı erişim kontrolü
  - Role-based erişim (admin, vice_president, ic_coordinator)
*/

-- 1. Stratejik Faaliyetler ile IC Süreçleri İlişki Tablosu
CREATE TABLE IF NOT EXISTS ic_activity_process_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  process_id uuid NOT NULL REFERENCES ic_processes(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'supports' CHECK (relationship_type IN ('supports', 'executes', 'controls', 'monitors')),
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(activity_id, process_id)
);

-- 2. Stratejik Faaliyetler ile IC Riskleri İlişki Tablosu
CREATE TABLE IF NOT EXISTS ic_activity_risk_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  risk_id uuid NOT NULL REFERENCES ic_risks(id) ON DELETE CASCADE,
  mitigation_impact text CHECK (mitigation_impact IN ('high', 'medium', 'low')),
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(activity_id, risk_id)
);

-- 3. Stratejik Faaliyetler ile IC Kontrolleri İlişki Tablosu
CREATE TABLE IF NOT EXISTS ic_activity_control_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  activity_id uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  control_id uuid NOT NULL REFERENCES ic_controls(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'strengthens' CHECK (relationship_type IN ('strengthens', 'implements', 'tests', 'monitors')),
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(activity_id, control_id)
);

-- 4. ic_action_plans tablosuna yeni alanlar ekle
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ic_action_plans' AND column_name = 'activity_id') THEN
    ALTER TABLE ic_action_plans ADD COLUMN activity_id uuid REFERENCES activities(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ic_action_plans' AND column_name = 'risk_id') THEN
    ALTER TABLE ic_action_plans ADD COLUMN risk_id uuid REFERENCES ic_risks(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ic_action_plans' AND column_name = 'control_id') THEN
    ALTER TABLE ic_action_plans ADD COLUMN control_id uuid REFERENCES ic_controls(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ic_action_plans' AND column_name = 'finding_id') THEN
    ALTER TABLE ic_action_plans ADD COLUMN finding_id uuid REFERENCES ic_findings(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ic_action_plans' AND column_name = 'capa_id') THEN
    ALTER TABLE ic_action_plans ADD COLUMN capa_id uuid REFERENCES ic_capas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 5. ic_capas tablosuna yeni alanlar ekle
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ic_capas' AND column_name = 'activity_id') THEN
    ALTER TABLE ic_capas ADD COLUMN activity_id uuid REFERENCES activities(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ic_capas' AND column_name = 'process_id') THEN
    ALTER TABLE ic_capas ADD COLUMN process_id uuid REFERENCES ic_processes(id) ON DELETE SET NULL;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ic_capas' AND column_name = 'kiks_standard_id') THEN
    ALTER TABLE ic_capas ADD COLUMN kiks_standard_id uuid REFERENCES ic_kiks_standards(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 6. RLS Politikaları

-- ic_activity_process_mappings
ALTER TABLE ic_activity_process_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity-process mappings in their organization"
  ON ic_activity_process_mappings FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage activity-process mappings"
  ON ic_activity_process_mappings FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'vice_president')
    )
  );

-- ic_activity_risk_mappings
ALTER TABLE ic_activity_risk_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity-risk mappings in their organization"
  ON ic_activity_risk_mappings FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage activity-risk mappings"
  ON ic_activity_risk_mappings FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'vice_president')
    )
  );

-- ic_activity_control_mappings
ALTER TABLE ic_activity_control_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view activity-control mappings in their organization"
  ON ic_activity_control_mappings FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage activity-control mappings"
  ON ic_activity_control_mappings FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'vice_president')
    )
  );

-- 7. İndeksler (Performans için)
CREATE INDEX IF NOT EXISTS idx_activity_process_mappings_activity ON ic_activity_process_mappings(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_process_mappings_process ON ic_activity_process_mappings(process_id);
CREATE INDEX IF NOT EXISTS idx_activity_process_mappings_org ON ic_activity_process_mappings(organization_id);

CREATE INDEX IF NOT EXISTS idx_activity_risk_mappings_activity ON ic_activity_risk_mappings(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_risk_mappings_risk ON ic_activity_risk_mappings(risk_id);
CREATE INDEX IF NOT EXISTS idx_activity_risk_mappings_org ON ic_activity_risk_mappings(organization_id);

CREATE INDEX IF NOT EXISTS idx_activity_control_mappings_activity ON ic_activity_control_mappings(activity_id);
CREATE INDEX IF NOT EXISTS idx_activity_control_mappings_control ON ic_activity_control_mappings(control_id);
CREATE INDEX IF NOT EXISTS idx_activity_control_mappings_org ON ic_activity_control_mappings(organization_id);

CREATE INDEX IF NOT EXISTS idx_action_plans_activity ON ic_action_plans(activity_id) WHERE activity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_plans_risk ON ic_action_plans(risk_id) WHERE risk_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_action_plans_control ON ic_action_plans(control_id) WHERE control_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_capas_activity ON ic_capas(activity_id) WHERE activity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_capas_process ON ic_capas(process_id) WHERE process_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_capas_kiks_standard ON ic_capas(kiks_standard_id) WHERE kiks_standard_id IS NOT NULL;
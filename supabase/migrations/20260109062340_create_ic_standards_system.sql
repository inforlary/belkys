/*
  # İç Kontrol Standartları Sistemi

  1. Yeni Tablolar
    - ic_components: İç kontrol bileşenleri (5 ana bileşen)
    - ic_standards: Standartlar (18 standart)
    - ic_general_conditions: Genel şartlar (her standart altında)
    - ic_condition_assessments: Organizasyon bazlı değerlendirmeler
    
  2. Mevcut Tablolara Ekleme
    - ic_actions tablosuna condition_id eklenir
    
  3. Security
    - Tüm tablolarda RLS aktif
    - Organization bazlı erişim kontrolü
    - Super admin tüm verilere erişebilir
*/

-- 1. BİLEŞENLER (organization_id NULL ise global)
CREATE TABLE IF NOT EXISTS ic_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(200) NOT NULL,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ic_components_org ON ic_components(organization_id);

-- 2. STANDARTLAR
CREATE TABLE IF NOT EXISTS ic_standards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component_id UUID REFERENCES ic_components(id) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(300) NOT NULL,
  description TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ic_standards_component ON ic_standards(component_id);

-- 3. GENEL ŞARTLAR
CREATE TABLE IF NOT EXISTS ic_general_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_id UUID REFERENCES ic_standards(id) ON DELETE CASCADE,
  code VARCHAR(20) NOT NULL,
  description TEXT NOT NULL,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ic_general_conditions_standard ON ic_general_conditions(standard_id);

-- 4. GENEL ŞART DEĞERLENDİRMELERİ
CREATE TABLE IF NOT EXISTS ic_condition_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  condition_id UUID REFERENCES ic_general_conditions(id) ON DELETE CASCADE,
  action_plan_id UUID REFERENCES ic_action_plans(id) ON DELETE CASCADE,
  compliance_status VARCHAR(20) CHECK (compliance_status IN ('COMPLIANT', 'NON_COMPLIANT', 'PARTIAL')),
  compliance_score INT CHECK (compliance_score BETWEEN 1 AND 5),
  current_situation TEXT,
  assessed_by UUID REFERENCES profiles(id),
  assessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, condition_id, action_plan_id)
);

CREATE INDEX IF NOT EXISTS idx_ic_condition_assessments_org ON ic_condition_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_condition_assessments_condition ON ic_condition_assessments(condition_id);
CREATE INDEX IF NOT EXISTS idx_ic_condition_assessments_plan ON ic_condition_assessments(action_plan_id);

-- 5. ic_actions tablosuna condition_id ekle
ALTER TABLE ic_actions
ADD COLUMN IF NOT EXISTS condition_id UUID REFERENCES ic_general_conditions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ic_actions_condition ON ic_actions(condition_id);

-- RLS Policies

-- ic_components
ALTER TABLE ic_components ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access to components"
  ON ic_components FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Users view global and own org components"
  ON ic_components FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_components.organization_id
    )
  );

CREATE POLICY "Admins manage own org components"
  ON ic_components FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_components.organization_id
      AND profiles.role IN ('ADMIN', 'DIRECTOR')
    )
  );

-- ic_standards
ALTER TABLE ic_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access to standards"
  ON ic_standards FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Users view all standards"
  ON ic_standards FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage standards via components"
  ON ic_standards FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN ic_components c ON c.id = ic_standards.component_id
      WHERE p.id = auth.uid()
      AND p.organization_id = c.organization_id
      AND p.role IN ('ADMIN', 'DIRECTOR')
    )
  );

-- ic_general_conditions
ALTER TABLE ic_general_conditions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access to conditions"
  ON ic_general_conditions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Users view all conditions"
  ON ic_general_conditions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage conditions via standards"
  ON ic_general_conditions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN ic_components c ON c.id IN (
        SELECT component_id FROM ic_standards WHERE id = ic_general_conditions.standard_id
      )
      WHERE p.id = auth.uid()
      AND p.organization_id = c.organization_id
      AND p.role IN ('ADMIN', 'DIRECTOR')
    )
  );

-- ic_condition_assessments
ALTER TABLE ic_condition_assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins full access to assessments"
  ON ic_condition_assessments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Users view own org assessments"
  ON ic_condition_assessments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_condition_assessments.organization_id
    )
  );

CREATE POLICY "Users insert own org assessments"
  ON ic_condition_assessments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_condition_assessments.organization_id
    )
  );

CREATE POLICY "Users update own org assessments"
  ON ic_condition_assessments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_condition_assessments.organization_id
    )
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_ic_condition_assessments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.assessed_at = NOW();
  NEW.assessed_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_update_ic_condition_assessments_updated_at
  BEFORE UPDATE ON ic_condition_assessments
  FOR EACH ROW
  EXECUTE FUNCTION update_ic_condition_assessments_updated_at();
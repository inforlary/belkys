/*
  # Hiyerarşik KİKS Standartları Yapısı

  1. Yeni Tablolar
    - `ic_kiks_categories` - Ana kategoriler (Kontrol Ortamı, Risk Değerlendirme, vb.)
    - `ic_kiks_main_standards` - Ana standartlar (KOS 1, KOS 2, vb.)
    - `ic_kiks_sub_standards` - Alt standartlar (KOS 1.1, KOS 1.2, vb.)
    - `ic_kiks_actions` - Eylemler/Faaliyetler (KOS 1.1.1, KOS 1.1.2, vb.)

  2. Özellikler
    - Her seviyede sorumlu ve işbirliği birimler
    - Hiyerarşik kod yapısı
    - Durum takibi
    - RLS güvenliği

  3. Güvenlik
    - Kullanıcılar kendi organizasyonlarını görür
    - Admin ve VP'ler yönetebilir
*/

-- Ana Kategoriler (Örn: KONTROL ORTAMI STANDARTLARI - KOS)
CREATE TABLE IF NOT EXISTS ic_kiks_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  description text,
  order_index integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ic_kiks_categories_org ON ic_kiks_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_kiks_categories_order ON ic_kiks_categories(order_index);

-- Ana Standartlar (Örn: KOS 1 - Etik Değerler ve Dürüstlük)
CREATE TABLE IF NOT EXISTS ic_kiks_main_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES ic_kiks_categories(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  responsible_departments uuid[] DEFAULT '{}',
  collaboration_departments uuid[] DEFAULT '{}',
  order_index integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, category_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ic_kiks_main_standards_org ON ic_kiks_main_standards(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_kiks_main_standards_category ON ic_kiks_main_standards(category_id);
CREATE INDEX IF NOT EXISTS idx_ic_kiks_main_standards_order ON ic_kiks_main_standards(order_index);

-- Alt Standartlar (Örn: KOS 1.1)
CREATE TABLE IF NOT EXISTS ic_kiks_sub_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  main_standard_id uuid NOT NULL REFERENCES ic_kiks_main_standards(id) ON DELETE CASCADE,
  code text NOT NULL,
  title text NOT NULL,
  description text,
  responsible_departments uuid[] DEFAULT '{}',
  collaboration_departments uuid[] DEFAULT '{}',
  order_index integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, main_standard_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ic_kiks_sub_standards_org ON ic_kiks_sub_standards(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_kiks_sub_standards_main ON ic_kiks_sub_standards(main_standard_id);
CREATE INDEX IF NOT EXISTS idx_ic_kiks_sub_standards_order ON ic_kiks_sub_standards(order_index);

-- Eylemler/Faaliyetler (Örn: KOS 1.1.1)
CREATE TABLE IF NOT EXISTS ic_kiks_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sub_standard_id uuid NOT NULL REFERENCES ic_kiks_sub_standards(id) ON DELETE CASCADE,
  code text NOT NULL,
  description text NOT NULL,
  responsible_departments uuid[] DEFAULT '{}',
  collaboration_departments uuid[] DEFAULT '{}',
  status text CHECK (status IN ('not_started', 'in_progress', 'completed', 'delayed')) DEFAULT 'not_started',
  start_date date,
  target_date date,
  completion_date date,
  notes text,
  order_index integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, sub_standard_id, code)
);

CREATE INDEX IF NOT EXISTS idx_ic_kiks_actions_org ON ic_kiks_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_ic_kiks_actions_sub ON ic_kiks_actions(sub_standard_id);
CREATE INDEX IF NOT EXISTS idx_ic_kiks_actions_status ON ic_kiks_actions(status);
CREATE INDEX IF NOT EXISTS idx_ic_kiks_actions_order ON ic_kiks_actions(order_index);

-- Updated_at trigger fonksiyonu (eğer yoksa)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger'lar
DROP TRIGGER IF EXISTS update_ic_kiks_categories_updated_at ON ic_kiks_categories;
CREATE TRIGGER update_ic_kiks_categories_updated_at
  BEFORE UPDATE ON ic_kiks_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ic_kiks_main_standards_updated_at ON ic_kiks_main_standards;
CREATE TRIGGER update_ic_kiks_main_standards_updated_at
  BEFORE UPDATE ON ic_kiks_main_standards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ic_kiks_sub_standards_updated_at ON ic_kiks_sub_standards;
CREATE TRIGGER update_ic_kiks_sub_standards_updated_at
  BEFORE UPDATE ON ic_kiks_sub_standards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_ic_kiks_actions_updated_at ON ic_kiks_actions;
CREATE TRIGGER update_ic_kiks_actions_updated_at
  BEFORE UPDATE ON ic_kiks_actions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS Politikaları

-- Categories
ALTER TABLE ic_kiks_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view KIKS categories in their org"
  ON ic_kiks_categories FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage KIKS categories"
  ON ic_kiks_categories FOR ALL
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

-- Main Standards
ALTER TABLE ic_kiks_main_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view KIKS main standards in their org"
  ON ic_kiks_main_standards FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage KIKS main standards"
  ON ic_kiks_main_standards FOR ALL
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

-- Sub Standards
ALTER TABLE ic_kiks_sub_standards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view KIKS sub standards in their org"
  ON ic_kiks_sub_standards FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage KIKS sub standards"
  ON ic_kiks_sub_standards FOR ALL
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

-- Actions
ALTER TABLE ic_kiks_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view KIKS actions in their org"
  ON ic_kiks_actions FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Department users can update their KIKS actions"
  ON ic_kiks_actions FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      (SELECT department_id FROM profiles WHERE id = auth.uid()) = ANY(responsible_departments)
      OR (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'vice_president')
    )
  )
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can manage KIKS actions"
  ON ic_kiks_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

CREATE POLICY "Admins can delete KIKS actions"
  ON ic_kiks_actions FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
  );

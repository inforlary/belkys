/*
  # Kalite Yönetimi - Süreç Yönetimi Sistemi

  1. Yeni Tablolar
    - `qm_process_categories`
      - Süreç kategorileri (Yönetim, Operasyonel, Destek)
    - `qm_processes`
      - Süreç tanımları (kod, ad, amaç, kapsam, girdiler, çıktılar)
    - `qm_process_kpis`
      - Süreç performans göstergeleri
    - `qm_process_kpi_values`
      - KPI ölçüm değerleri

  2. Güvenlik
    - RLS politikaları eklenmiştir
    - Super admin tam erişim
    - Admin ve yetkili kullanıcılar CRUD yapabilir
    
  3. Özellikler
    - Otomatik süreç kodu üretimi
    - KPI takip sistemi
    - Hiyerarşik süreç yapısı
*/

-- Süreç Kategorileri
CREATE TABLE IF NOT EXISTS qm_process_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Süreçler
CREATE TABLE IF NOT EXISTS qm_processes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  category_id UUID REFERENCES qm_process_categories(id) ON DELETE SET NULL,
  code VARCHAR(20) NOT NULL,
  name VARCHAR(300) NOT NULL,
  description TEXT,
  purpose TEXT,
  scope TEXT,
  process_owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  owner_department_id UUID REFERENCES departments(id) ON DELETE SET NULL,
  inputs TEXT,
  outputs TEXT,
  resources TEXT,
  related_documents TEXT,
  status VARCHAR(20) DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, code)
);

-- Süreç KPI'ları
CREATE TABLE IF NOT EXISTS qm_process_kpis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id UUID REFERENCES qm_processes(id) ON DELETE CASCADE,
  code VARCHAR(20),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  unit VARCHAR(50),
  target_value DECIMAL(18,4),
  measurement_frequency VARCHAR(20) DEFAULT 'MONTHLY' CHECK (measurement_frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY')),
  responsible_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- KPI Değerleri
CREATE TABLE IF NOT EXISTS qm_process_kpi_values (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id UUID REFERENCES qm_process_kpis(id) ON DELETE CASCADE,
  period_year INT NOT NULL,
  period_month INT CHECK (period_month BETWEEN 1 AND 12),
  period_quarter INT CHECK (period_quarter BETWEEN 1 AND 4),
  value DECIMAL(18,4),
  notes TEXT,
  entered_by UUID REFERENCES profiles(id),
  entered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kpi_id, period_year, period_month, period_quarter)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_qm_processes_org ON qm_processes(organization_id);
CREATE INDEX IF NOT EXISTS idx_qm_processes_category ON qm_processes(category_id);
CREATE INDEX IF NOT EXISTS idx_qm_processes_status ON qm_processes(status);
CREATE INDEX IF NOT EXISTS idx_qm_process_kpis_process ON qm_process_kpis(process_id);
CREATE INDEX IF NOT EXISTS idx_qm_process_kpi_values_kpi ON qm_process_kpi_values(kpi_id);

-- RLS Politikaları
ALTER TABLE qm_process_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE qm_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE qm_process_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE qm_process_kpi_values ENABLE ROW LEVEL SECURITY;

-- Kategori Politikaları
CREATE POLICY "qm_categories_select" ON qm_process_categories FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE organization_id = qm_process_categories.organization_id
      OR role = 'super_admin'
    )
  );

CREATE POLICY "qm_categories_insert" ON qm_process_categories FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE organization_id = qm_process_categories.organization_id
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "qm_categories_update" ON qm_process_categories FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE organization_id = qm_process_categories.organization_id
      AND role IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "qm_categories_delete" ON qm_process_categories FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE organization_id = qm_process_categories.organization_id
      AND role IN ('admin', 'super_admin')
    )
  );

-- Süreç Politikaları
CREATE POLICY "qm_processes_select" ON qm_processes FOR SELECT
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE organization_id = qm_processes.organization_id
      OR role = 'super_admin'
    )
  );

CREATE POLICY "qm_processes_insert" ON qm_processes FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE organization_id = qm_processes.organization_id
      AND role IN ('admin', 'director', 'super_admin')
    )
  );

CREATE POLICY "qm_processes_update" ON qm_processes FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE organization_id = qm_processes.organization_id
      AND role IN ('admin', 'director', 'super_admin')
    )
  );

CREATE POLICY "qm_processes_delete" ON qm_processes FOR DELETE
  USING (
    auth.uid() IN (
      SELECT id FROM profiles 
      WHERE organization_id = qm_processes.organization_id
      AND role IN ('admin', 'super_admin')
    )
  );

-- KPI Politikaları
CREATE POLICY "qm_kpis_select" ON qm_process_kpis FOR SELECT
  USING (
    auth.uid() IN (
      SELECT p.id FROM profiles p
      INNER JOIN qm_processes pr ON pr.organization_id = p.organization_id
      WHERE pr.id = qm_process_kpis.process_id
      OR p.role = 'super_admin'
    )
  );

CREATE POLICY "qm_kpis_insert" ON qm_process_kpis FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT p.id FROM profiles p
      INNER JOIN qm_processes pr ON pr.organization_id = p.organization_id
      WHERE pr.id = qm_process_kpis.process_id
      AND p.role IN ('admin', 'director', 'super_admin')
    )
  );

CREATE POLICY "qm_kpis_update" ON qm_process_kpis FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT p.id FROM profiles p
      INNER JOIN qm_processes pr ON pr.organization_id = p.organization_id
      WHERE pr.id = qm_process_kpis.process_id
      AND p.role IN ('admin', 'director', 'super_admin')
    )
  );

CREATE POLICY "qm_kpis_delete" ON qm_process_kpis FOR DELETE
  USING (
    auth.uid() IN (
      SELECT p.id FROM profiles p
      INNER JOIN qm_processes pr ON pr.organization_id = p.organization_id
      WHERE pr.id = qm_process_kpis.process_id
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- KPI Değer Politikaları
CREATE POLICY "qm_kpi_values_select" ON qm_process_kpi_values FOR SELECT
  USING (
    auth.uid() IN (
      SELECT p.id FROM profiles p
      INNER JOIN qm_process_kpis k ON k.id = qm_process_kpi_values.kpi_id
      INNER JOIN qm_processes pr ON pr.id = k.process_id
      WHERE pr.organization_id = p.organization_id
      OR p.role = 'super_admin'
    )
  );

CREATE POLICY "qm_kpi_values_insert" ON qm_process_kpi_values FOR INSERT
  WITH CHECK (
    auth.uid() IN (
      SELECT p.id FROM profiles p
      INNER JOIN qm_process_kpis k ON k.id = qm_process_kpi_values.kpi_id
      INNER JOIN qm_processes pr ON pr.id = k.process_id
      WHERE pr.organization_id = p.organization_id
      AND p.role IN ('admin', 'director', 'user', 'super_admin')
    )
  );

CREATE POLICY "qm_kpi_values_update" ON qm_process_kpi_values FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT p.id FROM profiles p
      INNER JOIN qm_process_kpis k ON k.id = qm_process_kpi_values.kpi_id
      INNER JOIN qm_processes pr ON pr.id = k.process_id
      WHERE pr.organization_id = p.organization_id
      AND p.role IN ('admin', 'director', 'super_admin')
    )
  );

CREATE POLICY "qm_kpi_values_delete" ON qm_process_kpi_values FOR DELETE
  USING (
    auth.uid() IN (
      SELECT p.id FROM profiles p
      INNER JOIN qm_process_kpis k ON k.id = qm_process_kpi_values.kpi_id
      INNER JOIN qm_processes pr ON pr.id = k.process_id
      WHERE pr.organization_id = p.organization_id
      AND p.role IN ('admin', 'super_admin')
    )
  );

-- Otomatik süreç kodu üretimi
CREATE OR REPLACE FUNCTION generate_qm_process_code(org_id UUID)
RETURNS VARCHAR(20) AS $$
DECLARE
  next_num INT;
  new_code VARCHAR(20);
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(code FROM 5) AS INT)), 0) + 1
  INTO next_num
  FROM qm_processes
  WHERE organization_id = org_id
  AND code ~ '^SRC-[0-9]+$';
  
  new_code := 'SRC-' || LPAD(next_num::TEXT, 3, '0');
  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_qm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER qm_categories_updated_at
  BEFORE UPDATE ON qm_process_categories
  FOR EACH ROW EXECUTE FUNCTION update_qm_updated_at();

CREATE TRIGGER qm_processes_updated_at
  BEFORE UPDATE ON qm_processes
  FOR EACH ROW EXECUTE FUNCTION update_qm_updated_at();

CREATE TRIGGER qm_kpis_updated_at
  BEFORE UPDATE ON qm_process_kpis
  FOR EACH ROW EXECUTE FUNCTION update_qm_updated_at();

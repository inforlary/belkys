/*
  # Kurumsal Risk Birim Etki Analizi Tablosu

  1. Yeni Tablo
    - `rm_risk_department_impacts`: Kurumsal risklerin birimlere etkilerini izler
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key)
      - `risk_id` (uuid, foreign key -> risks)
      - `department_id` (uuid, foreign key -> departments)
      - `impact_level` (integer, 0-5)
      - `impact_description` (text, nullable)
      - `affected_processes` (text, nullable)
      - `specific_controls` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Amaç
    - Kurumsal risklerin farklı birimlere olan etkilerini detaylı şekilde izlemek
    - Her birim için özel etki seviyesi ve kontrol önlemleri tanımlamak
    - Birim bazlı risk yönetimi stratejileri geliştirmek

  3. Güvenlik
    - RLS politikaları ile organizasyon bazlı erişim kontrolü
    - Sadece yetkili kullanıcılar etki analizi yapabilir
*/

-- Birim etki analizi tablosunu oluştur
CREATE TABLE IF NOT EXISTS rm_risk_department_impacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  impact_level INTEGER NOT NULL CHECK (impact_level >= 0 AND impact_level <= 5),
  impact_description TEXT,
  affected_processes TEXT,
  specific_controls TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(risk_id, department_id)
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_rm_risk_dept_impacts_org ON rm_risk_department_impacts(organization_id);
CREATE INDEX IF NOT EXISTS idx_rm_risk_dept_impacts_risk ON rm_risk_department_impacts(risk_id);
CREATE INDEX IF NOT EXISTS idx_rm_risk_dept_impacts_dept ON rm_risk_department_impacts(department_id);
CREATE INDEX IF NOT EXISTS idx_rm_risk_dept_impacts_level ON rm_risk_department_impacts(impact_level);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_rm_risk_dept_impacts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rm_risk_dept_impacts_updated_at
  BEFORE UPDATE ON rm_risk_department_impacts
  FOR EACH ROW
  EXECUTE FUNCTION update_rm_risk_dept_impacts_updated_at();

-- RLS politikaları
ALTER TABLE rm_risk_department_impacts ENABLE ROW LEVEL SECURITY;

-- Super admin tüm işlemleri yapabilir
CREATE POLICY "Super admins can manage all department impacts"
  ON rm_risk_department_impacts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Admin ve risk yöneticileri kendi organizasyonlarında okuyabilir
CREATE POLICY "Users can view department impacts in their organization"
  ON rm_risk_department_impacts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = rm_risk_department_impacts.organization_id
    )
  );

-- Admin ve risk yöneticileri kendi organizasyonlarında ekleyebilir
CREATE POLICY "Admins and risk managers can insert department impacts"
  ON rm_risk_department_impacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = rm_risk_department_impacts.organization_id
      AND profiles.role IN ('admin', 'risk_manager')
    )
  );

-- Admin ve risk yöneticileri kendi organizasyonlarında güncelleyebilir
CREATE POLICY "Admins and risk managers can update department impacts"
  ON rm_risk_department_impacts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = rm_risk_department_impacts.organization_id
      AND profiles.role IN ('admin', 'risk_manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = rm_risk_department_impacts.organization_id
      AND profiles.role IN ('admin', 'risk_manager')
    )
  );

-- Admin ve risk yöneticileri kendi organizasyonlarında silebilir
CREATE POLICY "Admins and risk managers can delete department impacts"
  ON rm_risk_department_impacts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = rm_risk_department_impacts.organization_id
      AND profiles.role IN ('admin', 'risk_manager')
    )
  );

COMMENT ON TABLE rm_risk_department_impacts IS 'Kurumsal risklerin birimlere etkilerini izler';
COMMENT ON COLUMN rm_risk_department_impacts.impact_level IS 'Etki seviyesi: 0=Etkilenmez, 1=Minimal, 2=Düşük, 3=Orta, 4=Yüksek, 5=Kritik';
COMMENT ON COLUMN rm_risk_department_impacts.affected_processes IS 'Etkilenen süreçler';
COMMENT ON COLUMN rm_risk_department_impacts.specific_controls IS 'Birime özel kontrol önlemleri';

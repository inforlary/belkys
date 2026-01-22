/*
  # Proje Rapor Geçmişi Tablosu

  1. Yeni Tablo
    - `project_report_history`
      - `id` (uuid, primary key)
      - `organization_id` (uuid, foreign key to organizations)
      - `report_type` (text) - ilyas, beyan, sp, period
      - `report_name` (text) - Rapor adı
      - `period_info` (jsonb) - Dönem bilgileri (year, period, vb.)
      - `format` (text) - excel, pdf, screen
      - `file_url` (text, nullable) - İndirilecek dosya URL'si
      - `created_by` (uuid, foreign key to profiles)
      - `created_at` (timestamptz)

  2. Güvenlik
    - RLS aktif
    - Kullanıcılar kendi organizasyonlarının raporlarını görebilir
    - Yeni rapor kaydı ekleyebilir
    - Sadece kendi oluşturduğu raporları silebilir
*/

-- Tabloyu oluştur
CREATE TABLE IF NOT EXISTS project_report_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('ilyas', 'beyan', 'sp', 'period')),
  report_name TEXT NOT NULL,
  period_info JSONB DEFAULT '{}',
  format TEXT NOT NULL CHECK (format IN ('excel', 'pdf', 'screen')),
  file_url TEXT,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_project_report_history_org ON project_report_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_project_report_history_created_at ON project_report_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_report_history_type ON project_report_history(report_type);

-- RLS aktif
ALTER TABLE project_report_history ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar kendi organizasyonlarının raporlarını görebilir
CREATE POLICY "Users can view organization report history"
  ON project_report_history
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Kullanıcılar rapor kaydı ekleyebilir
CREATE POLICY "Users can create report history"
  ON project_report_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Kullanıcılar kendi oluşturduğu raporları silebilir
CREATE POLICY "Users can delete own reports"
  ON project_report_history
  FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Super adminler tüm raporları görebilir ve silebilir
CREATE POLICY "Super admins full access to report history"
  ON project_report_history
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'super_admin'
    )
  );

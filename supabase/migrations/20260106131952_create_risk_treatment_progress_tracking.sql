/*
  # Risk Faaliyet İlerleme Takibi

  1. Yeni Tablo
    - `risk_treatment_progress` - Risk faaliyet ilerleme kayıtları
      - `id` (uuid, primary key)
      - `treatment_id` (uuid, foreign key -> risk_treatments)
      - `progress_percent` (int) - İlerleme yüzdesi
      - `status` (varchar) - Durum
      - `notes` (text) - Açıklama/notlar
      - `updated_by_id` (uuid, foreign key -> profiles)
      - `created_at` (timestamptz)

  2. Güvenlik
    - RLS aktif
    - Organization bazlı erişim kontrolleri
*/

CREATE TABLE IF NOT EXISTS risk_treatment_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id UUID REFERENCES risk_treatments(id) ON DELETE CASCADE NOT NULL,
  progress_percent INT CHECK (progress_percent BETWEEN 0 AND 100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  notes TEXT,
  updated_by_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_risk_treatment_progress_treatment 
  ON risk_treatment_progress(treatment_id);

CREATE INDEX IF NOT EXISTS idx_risk_treatment_progress_created 
  ON risk_treatment_progress(created_at DESC);

ALTER TABLE risk_treatment_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risk treatment progress"
  ON risk_treatment_progress FOR SELECT
  TO authenticated
  USING (
    treatment_id IN (
      SELECT rt.id FROM risk_treatments rt
      JOIN risks r ON rt.risk_id = r.id
      WHERE r.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can insert risk treatment progress"
  ON risk_treatment_progress FOR INSERT
  TO authenticated
  WITH CHECK (
    treatment_id IN (
      SELECT rt.id FROM risk_treatments rt
      JOIN risks r ON rt.risk_id = r.id
      WHERE r.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can manage risk treatment progress"
  ON risk_treatment_progress FOR ALL
  TO authenticated
  USING (
    treatment_id IN (
      SELECT rt.id FROM risk_treatments rt
      JOIN risks r ON rt.risk_id = r.id
      WHERE r.organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
      )
    )
  );

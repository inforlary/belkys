/*
  # İç Kontrol Değerlendirme Detayları Tablosu

  1. Yeni Tablo
    - `ic_assessment_details`
      - Standart bazlı değerlendirme detaylarını saklar
      - Her standardın uyum seviyesi, güçlü/zayıf yönler
      - Kanıtlar ve öneriler
  
  2. Güvenlik
    - RLS etkinleştirildi
    - Super admin, admin, ic_coordinator tam erişim
    - Diğer kullanıcılar kendi organizasyonlarını görür
*/

-- Tablo oluştur
CREATE TABLE IF NOT EXISTS ic_assessment_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID REFERENCES ic_assessments(id) ON DELETE CASCADE,
  standard_id UUID REFERENCES ic_standards(id),
  
  compliance_level INT NOT NULL CHECK (compliance_level BETWEEN 1 AND 5),
  compliance_score DECIMAL(5,2),
  
  strengths TEXT,
  weaknesses TEXT,
  evidences TEXT,
  recommendations TEXT,
  action_required BOOLEAN DEFAULT false,
  
  assessor_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(assessment_id, standard_id)
);

-- RLS aktif et
ALTER TABLE ic_assessment_details ENABLE ROW LEVEL SECURITY;

-- İndeks ekle
CREATE INDEX IF NOT EXISTS idx_ic_assessment_details_assessment ON ic_assessment_details(assessment_id);
CREATE INDEX IF NOT EXISTS idx_ic_assessment_details_standard ON ic_assessment_details(standard_id);

-- RLS Politikaları
CREATE POLICY "Super admins can do everything on assessment details"
  ON ic_assessment_details FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Admins and IC coordinators can manage assessment details"
  ON ic_assessment_details FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN ic_assessments a ON a.id = ic_assessment_details.assessment_id
      WHERE p.id = auth.uid()
      AND p.organization_id = a.organization_id
      AND p.role IN ('admin', 'ic_coordinator')
    )
  );

CREATE POLICY "Users can view assessment details in their organization"
  ON ic_assessment_details FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      JOIN ic_assessments a ON a.id = ic_assessment_details.assessment_id
      WHERE p.id = auth.uid()
      AND p.organization_id = a.organization_id
    )
  );
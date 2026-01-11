/*
  # Risk Çoklu Kategori Desteği

  1. Değişiklikler
    - `risk_category_mappings` tablosu oluşturulur (bir risk birden fazla kategoriye ait olabilir)
    - Mevcut category_id verileri yeni tabloya taşınır
    - İndeksler oluşturulur

  2. Güvenlik
    - RLS politikaları eklenir
    - Organization bazlı erişim kontrolleri
*/

-- Create risk_category_mappings table
CREATE TABLE IF NOT EXISTS risk_category_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES risk_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(risk_id, category_id)
);

-- Migrate existing data
INSERT INTO risk_category_mappings (risk_id, category_id)
SELECT id, category_id
FROM risks
WHERE category_id IS NOT NULL
ON CONFLICT (risk_id, category_id) DO NOTHING;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_risk_category_mappings_risk_id ON risk_category_mappings(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_category_mappings_category_id ON risk_category_mappings(category_id);

-- Enable RLS
ALTER TABLE risk_category_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view risk category mappings in their organization"
  ON risk_category_mappings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM risks
      WHERE risks.id = risk_category_mappings.risk_id
      AND risks.organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins and directors can insert risk category mappings"
  ON risk_category_mappings FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM risks
      WHERE risks.id = risk_category_mappings.risk_id
      AND risks.organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'director')
      )
    )
  );

CREATE POLICY "Admins and directors can delete risk category mappings"
  ON risk_category_mappings FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM risks
      WHERE risks.id = risk_category_mappings.risk_id
      AND risks.organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'director')
      )
    )
  );

CREATE POLICY "Super admins can manage all risk category mappings"
  ON risk_category_mappings FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Add comment
COMMENT ON TABLE risk_category_mappings IS 'Bir risk birden fazla kategoriye ait olabilir (many-to-many ilişki)';

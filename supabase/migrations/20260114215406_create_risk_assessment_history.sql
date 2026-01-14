/*
  # Risk Değerlendirme Tarihçesi Sistemi

  1. Yeni Tablo
    - `rm_risk_assessments` - Risk değerlendirme tarihçesi kayıtları
      - `id` (UUID, primary key)
      - `organization_id` (UUID, foreign key)
      - `risk_id` (UUID, foreign key -> risks)
      - `assessed_by` (UUID, foreign key -> profiles)
      - `assessed_at` (TIMESTAMPTZ, default NOW())
      - `inherent_probability` (INTEGER, 1-5)
      - `inherent_impact` (INTEGER, 1-5)
      - `inherent_score` (INTEGER, calculated)
      - `residual_probability` (INTEGER, 1-5)
      - `residual_impact` (INTEGER, 1-5)
      - `residual_score` (INTEGER, calculated)
      - `notes` (TEXT, nullable)
      - `created_at` (TIMESTAMPTZ)

  2. Özellikler
    - Otomatik skor hesaplama
    - Tarihçe takibi
    - RLS politikaları
*/

-- Create risk assessments table
CREATE TABLE IF NOT EXISTS rm_risk_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  risk_id UUID NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  assessed_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  assessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  inherent_probability INTEGER NOT NULL CHECK (inherent_probability >= 1 AND inherent_probability <= 5),
  inherent_impact INTEGER NOT NULL CHECK (inherent_impact >= 1 AND inherent_impact <= 5),
  inherent_score INTEGER NOT NULL,
  residual_probability INTEGER NOT NULL CHECK (residual_probability >= 1 AND residual_probability <= 5),
  residual_impact INTEGER NOT NULL CHECK (residual_impact >= 1 AND residual_impact <= 5),
  residual_score INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rm_risk_assessments_organization ON rm_risk_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_rm_risk_assessments_risk ON rm_risk_assessments(risk_id);
CREATE INDEX IF NOT EXISTS idx_rm_risk_assessments_assessed_at ON rm_risk_assessments(assessed_at DESC);
CREATE INDEX IF NOT EXISTS idx_rm_risk_assessments_assessed_by ON rm_risk_assessments(assessed_by);

-- Enable RLS
ALTER TABLE rm_risk_assessments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view assessments in their organization"
ON rm_risk_assessments FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can insert assessments in their organization"
ON rm_risk_assessments FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Super admins have full access to all assessments"
ON rm_risk_assessments FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
  )
);

-- Create function to automatically create assessment history
CREATE OR REPLACE FUNCTION create_risk_assessment_history()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create history record if risk scores have changed
  IF (TG_OP = 'UPDATE' AND (
    OLD.inherent_likelihood != NEW.inherent_likelihood OR
    OLD.inherent_impact != NEW.inherent_impact OR
    OLD.residual_likelihood != NEW.residual_likelihood OR
    OLD.residual_impact != NEW.residual_impact
  )) OR TG_OP = 'INSERT' THEN
    
    INSERT INTO rm_risk_assessments (
      organization_id,
      risk_id,
      assessed_by,
      assessed_at,
      inherent_probability,
      inherent_impact,
      inherent_score,
      residual_probability,
      residual_impact,
      residual_score,
      notes
    ) VALUES (
      NEW.organization_id,
      NEW.id,
      COALESCE(NEW.identified_by_id, auth.uid()),
      NOW(),
      NEW.inherent_likelihood,
      NEW.inherent_impact,
      NEW.inherent_score,
      NEW.residual_likelihood,
      NEW.residual_impact,
      NEW.residual_score,
      CASE 
        WHEN TG_OP = 'INSERT' THEN 'İlk değerlendirme'
        ELSE 'Risk değerlendirmesi güncellendi'
      END
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on risks table
DROP TRIGGER IF EXISTS trg_risk_assessment_history ON risks;
CREATE TRIGGER trg_risk_assessment_history
AFTER INSERT OR UPDATE ON risks
FOR EACH ROW
EXECUTE FUNCTION create_risk_assessment_history();

-- Create function to get risk assessment timeline
CREATE OR REPLACE FUNCTION get_risk_assessment_timeline(
  p_risk_id UUID
) RETURNS TABLE (
  assessment_id UUID,
  assessed_at TIMESTAMPTZ,
  assessed_by_name TEXT,
  inherent_probability INTEGER,
  inherent_impact INTEGER,
  inherent_score INTEGER,
  residual_probability INTEGER,
  residual_impact INTEGER,
  residual_score INTEGER,
  notes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ra.id,
    ra.assessed_at,
    p.full_name,
    ra.inherent_probability,
    ra.inherent_impact,
    ra.inherent_score,
    ra.residual_probability,
    ra.residual_impact,
    ra.residual_score,
    ra.notes
  FROM rm_risk_assessments ra
  LEFT JOIN profiles p ON p.id = ra.assessed_by
  WHERE ra.risk_id = p_risk_id
  ORDER BY ra.assessed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_risk_assessment_timeline TO authenticated;

-- Add comments
COMMENT ON TABLE rm_risk_assessments IS 'Risk değerlendirme tarihçesi - her değişiklik kaydedilir';
COMMENT ON COLUMN rm_risk_assessments.assessed_at IS 'Değerlendirme zamanı';
COMMENT ON COLUMN rm_risk_assessments.inherent_score IS 'Doğal risk skoru (olasılık x etki)';
COMMENT ON COLUMN rm_risk_assessments.residual_score IS 'Artık risk skoru (olasılık x etki)';

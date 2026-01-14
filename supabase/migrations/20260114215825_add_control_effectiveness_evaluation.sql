/*
  # Kontrol Etkinlik Değerlendirmesi Sistemi

  1. Yeni Kolonlar (risk_controls tablosu)
    - `design_effectiveness` - Tasarım etkinliği puanı (1-5)
    - `operating_effectiveness` - Çalışma etkinliği puanı (1-5)
    - `effectiveness_notes` - Etkinlik değerlendirme notları
    - `last_effectiveness_review` - Son değerlendirme tarihi
    - `reviewed_by` - Değerlendirmeyi yapan kullanıcı

  2. Özellikler
    - 1-5 arası puanlama sistemi
    - Tasarım ve çalışma etkinliği ayrı ayrı değerlendirilir
    - Değerlendirme tarihi ve sorumlusu takip edilir
*/

-- Add effectiveness evaluation columns to risk_controls
ALTER TABLE risk_controls 
  ADD COLUMN IF NOT EXISTS design_effectiveness INTEGER CHECK (design_effectiveness >= 1 AND design_effectiveness <= 5),
  ADD COLUMN IF NOT EXISTS operating_effectiveness INTEGER CHECK (operating_effectiveness >= 1 AND operating_effectiveness <= 5),
  ADD COLUMN IF NOT EXISTS effectiveness_notes TEXT,
  ADD COLUMN IF NOT EXISTS last_effectiveness_review DATE,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Create index for filtering by effectiveness
CREATE INDEX IF NOT EXISTS idx_risk_controls_design_effectiveness ON risk_controls(design_effectiveness);
CREATE INDEX IF NOT EXISTS idx_risk_controls_operating_effectiveness ON risk_controls(operating_effectiveness);
CREATE INDEX IF NOT EXISTS idx_risk_controls_reviewed_by ON risk_controls(reviewed_by);

-- Create function to get low effectiveness controls
CREATE OR REPLACE FUNCTION get_low_effectiveness_controls(
  p_organization_id UUID,
  p_threshold INTEGER DEFAULT 3
) RETURNS TABLE (
  control_id UUID,
  control_name TEXT,
  risk_code TEXT,
  risk_title TEXT,
  design_effectiveness INTEGER,
  operating_effectiveness INTEGER,
  responsible_department_name TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rc.id,
    rc.name,
    r.code,
    r.title,
    rc.design_effectiveness,
    rc.operating_effectiveness,
    d.name
  FROM risk_controls rc
  JOIN risks r ON r.id = rc.risk_id
  LEFT JOIN departments d ON d.id = rc.responsible_department_id
  WHERE r.organization_id = p_organization_id
    AND (
      rc.design_effectiveness < p_threshold 
      OR rc.operating_effectiveness < p_threshold
    )
  ORDER BY 
    LEAST(COALESCE(rc.design_effectiveness, 0), COALESCE(rc.operating_effectiveness, 0)) ASC,
    rc.name ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_low_effectiveness_controls TO authenticated;

-- Add comments
COMMENT ON COLUMN risk_controls.design_effectiveness IS 'Tasarım etkinliği (1-5): Kontrol doğru tasarlanmış mı?';
COMMENT ON COLUMN risk_controls.operating_effectiveness IS 'Çalışma etkinliği (1-5): Kontrol pratikte çalışıyor mu?';
COMMENT ON COLUMN risk_controls.effectiveness_notes IS 'Etkinlik değerlendirme notları';
COMMENT ON COLUMN risk_controls.last_effectiveness_review IS 'Son etkinlik değerlendirme tarihi';
COMMENT ON COLUMN risk_controls.reviewed_by IS 'Değerlendirmeyi yapan kullanıcı';

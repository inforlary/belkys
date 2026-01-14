/*
  # Hedef Risk Değerlendirmesi Sistemi

  1. Yeni Kolonlar (risks tablosu)
    - `target_probability` - Hedef olasılık (1-5)
    - `target_impact` - Hedef etki (1-5)
    - `target_score` - Hedef risk skoru (otomatik hesaplanır)
    - `target_date` - Hedefe ulaşılması beklenen tarih

  2. Özellikler
    - Hedef risk seviyesi belirleme
    - Hedef tarih takibi
    - Otomatik skor hesaplama
    - İlerleme takibi için temel yapı

  3. Fonksiyonlar
    - Otomatik hedef skor hesaplama trigger'ı
    - Hedefe ulaşma durumu kontrolü
*/

-- Add target risk assessment columns to risks table
ALTER TABLE risks 
  ADD COLUMN IF NOT EXISTS target_probability INTEGER CHECK (target_probability >= 1 AND target_probability <= 5),
  ADD COLUMN IF NOT EXISTS target_impact INTEGER CHECK (target_impact >= 1 AND target_impact <= 5),
  ADD COLUMN IF NOT EXISTS target_score INTEGER,
  ADD COLUMN IF NOT EXISTS target_date DATE;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_risks_target_score ON risks(target_score);
CREATE INDEX IF NOT EXISTS idx_risks_target_date ON risks(target_date);

-- Create function to calculate target score
CREATE OR REPLACE FUNCTION calculate_target_score()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.target_probability IS NOT NULL AND NEW.target_impact IS NOT NULL THEN
    NEW.target_score := NEW.target_probability * NEW.target_impact;
  ELSE
    NEW.target_score := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic target score calculation
DROP TRIGGER IF EXISTS trigger_calculate_target_score ON risks;
CREATE TRIGGER trigger_calculate_target_score
  BEFORE INSERT OR UPDATE OF target_probability, target_impact
  ON risks
  FOR EACH ROW
  EXECUTE FUNCTION calculate_target_score();

-- Create function to get risks achieving target
CREATE OR REPLACE FUNCTION get_risks_achieving_target(
  p_organization_id UUID
) RETURNS TABLE (
  risk_id UUID,
  risk_code TEXT,
  risk_title TEXT,
  residual_score INTEGER,
  target_score INTEGER,
  achievement_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.code,
    r.title,
    r.residual_score,
    r.target_score,
    CASE 
      WHEN r.target_score IS NOT NULL AND r.target_score > 0 
      THEN ROUND(((r.residual_score::NUMERIC - r.target_score::NUMERIC) / r.residual_score::NUMERIC) * 100, 1)
      ELSE 0
    END as achievement_percentage
  FROM risks r
  WHERE r.organization_id = p_organization_id
    AND r.is_active = true
    AND r.target_score IS NOT NULL
    AND r.residual_score IS NOT NULL
    AND r.residual_score <= r.target_score
  ORDER BY r.residual_score ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get risks behind target
CREATE OR REPLACE FUNCTION get_risks_behind_target(
  p_organization_id UUID
) RETURNS TABLE (
  risk_id UUID,
  risk_code TEXT,
  risk_title TEXT,
  residual_score INTEGER,
  target_score INTEGER,
  gap INTEGER,
  target_date DATE,
  days_until_target INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.id,
    r.code,
    r.title,
    r.residual_score,
    r.target_score,
    (r.residual_score - r.target_score) as gap,
    r.target_date,
    CASE 
      WHEN r.target_date IS NOT NULL 
      THEN (r.target_date - CURRENT_DATE)::INTEGER
      ELSE NULL
    END as days_until_target
  FROM risks r
  WHERE r.organization_id = p_organization_id
    AND r.is_active = true
    AND r.target_score IS NOT NULL
    AND r.residual_score IS NOT NULL
    AND r.residual_score > r.target_score
  ORDER BY gap DESC, days_until_target ASC NULLS LAST;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_target_score TO authenticated;
GRANT EXECUTE ON FUNCTION get_risks_achieving_target TO authenticated;
GRANT EXECUTE ON FUNCTION get_risks_behind_target TO authenticated;

-- Add comments
COMMENT ON COLUMN risks.target_probability IS 'Hedef risk olasılığı (1-5): Ulaşmak istediğimiz olasılık seviyesi';
COMMENT ON COLUMN risks.target_impact IS 'Hedef risk etkisi (1-5): Ulaşmak istediğimiz etki seviyesi';
COMMENT ON COLUMN risks.target_score IS 'Hedef risk skoru: target_probability * target_impact (otomatik hesaplanır)';
COMMENT ON COLUMN risks.target_date IS 'Hedef tarih: Bu risk seviyesine ne zaman ulaşmayı hedefliyoruz?';

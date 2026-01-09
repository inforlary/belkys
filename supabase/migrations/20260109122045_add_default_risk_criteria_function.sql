/*
  # Add Default Risk Criteria Function

  1. Function
    - `initialize_default_risk_criteria(org_id UUID)` - Creates default likelihood and impact criteria
    
  2. Default Criteria
    - 5 levels of likelihood criteria with percentage ranges
    - 5 levels of impact criteria
*/

CREATE OR REPLACE FUNCTION initialize_default_risk_criteria(org_id UUID)
RETURNS void AS $$
BEGIN
  -- Check if criteria already exist
  IF EXISTS (
    SELECT 1 FROM risk_criteria 
    WHERE organization_id = org_id
  ) THEN
    RETURN;
  END IF;

  -- Insert likelihood criteria
  INSERT INTO risk_criteria (organization_id, criteria_type, level, name, description, percentage_min, percentage_max)
  VALUES 
    (org_id, 'LIKELIHOOD', 1, 'Çok Düşük', 'Gerçekleşmesi çok zayıf ihtimal', 0, 10),
    (org_id, 'LIKELIHOOD', 2, 'Düşük', 'Gerçekleşme ihtimali düşük', 10, 30),
    (org_id, 'LIKELIHOOD', 3, 'Orta', 'Gerçekleşme ihtimali orta düzeyde', 30, 50),
    (org_id, 'LIKELIHOOD', 4, 'Yüksek', 'Gerçekleşme ihtimali yüksek', 50, 70),
    (org_id, 'LIKELIHOOD', 5, 'Çok Yüksek', 'Gerçekleşmesi neredeyse kesin', 70, 100);

  -- Insert impact criteria
  INSERT INTO risk_criteria (organization_id, criteria_type, level, name, description, percentage_min, percentage_max)
  VALUES 
    (org_id, 'IMPACT', 1, 'Çok Düşük', 'Etkisi ihmal edilebilir düzeyde. Günlük operasyonları etkilemez.', NULL, NULL),
    (org_id, 'IMPACT', 2, 'Düşük', 'Sınırlı etki. Küçük aksaklıklar yaratır, kolayca giderilebilir.', NULL, NULL),
    (org_id, 'IMPACT', 3, 'Orta', 'Orta düzey etki. Bazı hedeflerin gecikmesine neden olabilir.', NULL, NULL),
    (org_id, 'IMPACT', 4, 'Yüksek', 'Önemli etki. Stratejik hedefleri olumsuz etkiler, ciddi kayıplara yol açar.', NULL, NULL),
    (org_id, 'IMPACT', 5, 'Çok Yüksek', 'Kritik/felaket düzeyinde etki. Kurumun varlığını veya itibarını tehdit eder.', NULL, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

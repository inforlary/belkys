/*
  # Fix Unique Constraints for Fiscal Year Cloning

  1. Problem
    - `unique_activity_indicator` constraint fiscal_year içermiyor
    - Yeni yıl klonlanırken duplicate key hatası veriyor
    - Aynı activity + indicator kombinasyonu farklı yıllar için kullanılamıyor

  2. Solution
    - Eski `unique_activity_indicator` constraint'ini kaldır
    - Eski `unique_indicator_usage` constraint'ini de kaldır (her gösterge her yıl kullanılabilmeli)
    - Sadece `unique_mapping_per_year` constraint'ini kullan (fiscal_year içeriyor)

  3. Effect
    - Aynı gösterge farklı yıllarda kullanılabilir
    - Yıllık klonlama çalışır
    - Her yıl için unique mapping garantisi devam eder
*/

-- Remove old constraints that don't include fiscal_year
ALTER TABLE program_activity_indicator_mappings
DROP CONSTRAINT IF EXISTS unique_activity_indicator;

ALTER TABLE program_activity_indicator_mappings
DROP CONSTRAINT IF EXISTS unique_indicator_usage;

-- Ensure unique_mapping_per_year constraint exists (should already exist from previous migration)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_mapping_per_year'
    AND conrelid = 'program_activity_indicator_mappings'::regclass
  ) THEN
    ALTER TABLE program_activity_indicator_mappings
    ADD CONSTRAINT unique_mapping_per_year
    UNIQUE NULLS NOT DISTINCT (organization_id, activity_id, indicator_id, fiscal_year);
  END IF;
END $$;

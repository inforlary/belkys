/*
  # Add Calculation Method to Indicators

  ## Changes
  1. New Columns
    - `calculation_method` (text): Hesaplama yöntemi
      - 'standard': Normal hesaplama (varsayılan)
      - 'cumulative': Kümülatif değer (başlangıç + toplam)
      - 'percentage': Yüzde değer
      - 'cumulative_decreasing': Kümülatif azalan değer
    
    - `baseline_value` (numeric): Başlangıç değeri (kümülatif hesaplamalar için)
    - `calculation_notes` (text): Hesaplama yöntemi açıklaması

  ## Notes
  - Varsayılan hesaplama yöntemi 'standard' olacak
  - baseline_value nullable (tüm göstergeler için gerekmez)
  - Mevcut göstergelere 'standard' atanacak
*/

-- Add calculation method fields to indicators table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'indicators' AND column_name = 'calculation_method'
  ) THEN
    ALTER TABLE indicators ADD COLUMN calculation_method text DEFAULT 'standard';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'indicators' AND column_name = 'baseline_value'
  ) THEN
    ALTER TABLE indicators ADD COLUMN baseline_value numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'indicators' AND column_name = 'calculation_notes'
  ) THEN
    ALTER TABLE indicators ADD COLUMN calculation_notes text;
  END IF;
END $$;

-- Add check constraint for valid calculation methods
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'indicators_calculation_method_check'
  ) THEN
    ALTER TABLE indicators ADD CONSTRAINT indicators_calculation_method_check 
    CHECK (calculation_method IN ('standard', 'cumulative', 'percentage', 'cumulative_decreasing'));
  END IF;
END $$;

-- Update existing indicators to use standard method
UPDATE indicators 
SET calculation_method = 'standard' 
WHERE calculation_method IS NULL;
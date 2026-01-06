/*
  # Risk Indicators Enhancement

  1. Changes
    - Add data_source field to risk_indicators
    - Add calculation_method field to risk_indicators
    - Add analysis field to risk_indicator_values

  2. Security
    - No RLS changes needed
*/

-- Add data_source to risk_indicators if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risk_indicators' AND column_name = 'data_source'
  ) THEN
    ALTER TABLE risk_indicators ADD COLUMN data_source VARCHAR(200);
  END IF;
END $$;

-- Add calculation_method to risk_indicators if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risk_indicators' AND column_name = 'calculation_method'
  ) THEN
    ALTER TABLE risk_indicators ADD COLUMN calculation_method TEXT;
  END IF;
END $$;

-- Add analysis to risk_indicator_values if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risk_indicator_values' AND column_name = 'analysis'
  ) THEN
    ALTER TABLE risk_indicator_values ADD COLUMN analysis TEXT;
  END IF;
END $$;

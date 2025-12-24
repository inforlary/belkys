/*
  # Add baseline_value to indicator_targets

  1. Changes
    - Add `baseline_value` column to `indicator_targets` table
    - This column stores the starting value (A) for performance calculations
  
  2. Notes
    - Nullable to allow gradual data population
    - No default value as it should be explicitly set
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'indicator_targets' AND column_name = 'baseline_value'
  ) THEN
    ALTER TABLE indicator_targets ADD COLUMN baseline_value numeric;
  END IF;
END $$;

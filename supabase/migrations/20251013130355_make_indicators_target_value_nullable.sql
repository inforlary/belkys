/*
  # Make target_value nullable in indicators table

  1. Changes
    - Remove NOT NULL constraint from `target_value` column in `indicators` table
    - This is because we now use `indicator_targets` table for multi-year targets
    - The old `target_value` column is kept for backward compatibility but not required

  2. Notes
    - Multi-year targets are now stored in `indicator_targets` table
    - Each indicator can have multiple year-based targets
*/

-- Remove NOT NULL constraint from target_value
ALTER TABLE indicators ALTER COLUMN target_value DROP NOT NULL;

-- Also make target_year nullable since we use indicator_targets now
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'indicators' AND column_name = 'target_year'
  ) THEN
    ALTER TABLE indicators ALTER COLUMN target_year DROP NOT NULL;
  END IF;
END $$;

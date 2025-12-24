/*
  # Add output_result field to ic_kiks_actions table

  1. Changes
    - Add `output_result` column to `ic_kiks_actions` table
      - Type: text (nullable)
      - Purpose: Store the expected output/result of the action
  
  2. Purpose
    - Allow storing planned outputs/results for each KİKS action
    - This field will be displayed in the action plan reports
*/

-- Add output_result column to ic_kiks_actions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_kiks_actions' AND column_name = 'output_result'
  ) THEN
    ALTER TABLE ic_kiks_actions ADD COLUMN output_result text;
  END IF;
END $$;
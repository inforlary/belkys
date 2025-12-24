/*
  # Add code column to indicators table

  1. Changes
    - Add `code` column to `indicators` table
    - Add index for better performance on code lookups
    - Code will store indicator codes like G1.1.1, G1.1.2, etc.

  2. Notes
    - Existing records will have NULL code, need to be updated manually or via app
*/

-- Add code column to indicators table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'indicators' AND column_name = 'code'
  ) THEN
    ALTER TABLE indicators ADD COLUMN code text;
  END IF;
END $$;

-- Create index on code for better performance
CREATE INDEX IF NOT EXISTS idx_indicators_code ON indicators(code);

-- Create index on organization_id and code combination
CREATE INDEX IF NOT EXISTS idx_indicators_org_code ON indicators(organization_id, code);

/*
  # Add metadata column to ic_action_plans table

  1. Changes
    - Add `metadata` column (jsonb) to `ic_action_plans` table
    - This column stores additional contextual information for action plans
    - Used for storing KIKS standard details, risk information, and other metadata

  2. Purpose
    - Enable storing flexible additional data for action plans
    - Support compliance action plan generation with full context
*/

-- Add metadata column to ic_action_plans
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ic_action_plans' AND column_name = 'metadata'
  ) THEN
    ALTER TABLE ic_action_plans ADD COLUMN metadata jsonb;
  END IF;
END $$;

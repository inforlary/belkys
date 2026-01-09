/*
  # Add goal_id to risks table

  1. Changes
    - Add `goal_id` column to risks table
    - Create index for better query performance
    - Keep objective_id for backward compatibility

  2. Security
    - No RLS changes needed
*/

-- Add goal_id to risks table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risks' AND column_name = 'goal_id'
  ) THEN
    ALTER TABLE risks ADD COLUMN goal_id UUID REFERENCES goals(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_risks_goal_id ON risks(goal_id);

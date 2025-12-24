/*
  # Fix Activities - Make goal_id nullable for budget activities

  1. Changes
    - Make `goal_id` nullable in activities table
    - Budget program activities don't need a goal_id
    - Strategic planning activities still have goal_id

  2. Security
    - Maintains existing RLS policies
*/

-- Make goal_id nullable for budget activities
ALTER TABLE activities 
ALTER COLUMN goal_id DROP NOT NULL;

-- Add check: either goal_id or sub_program_id must exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'activities_goal_or_subprogram_check'
  ) THEN
    ALTER TABLE activities 
    ADD CONSTRAINT activities_goal_or_subprogram_check 
    CHECK (goal_id IS NOT NULL OR sub_program_id IS NOT NULL);
  END IF;
END $$;
/*
  # Move department field from objectives to goals

  1. Changes
    - Remove `department_id` from objectives table
    - Add `department_id` to goals table with foreign key to departments
    - This allows multiple departments to work on different goals under the same objective

  2. Security
    - No RLS changes needed, existing policies will work
*/

-- Add department_id to goals table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'goals' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE goals ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_goals_department_id ON goals(department_id);

-- Remove department_id from objectives table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'objectives' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE objectives DROP COLUMN department_id;
  END IF;
END $$;

-- Drop the index from objectives if it exists
DROP INDEX IF EXISTS idx_objectives_department_id;

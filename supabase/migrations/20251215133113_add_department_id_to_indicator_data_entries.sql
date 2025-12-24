/*
  # Add department_id to indicator_data_entries

  1. Changes
    - Add `department_id` column to `indicator_data_entries` table
    - Add foreign key constraint to departments
    - Create index for better query performance
    - Update existing records to populate department_id from indicator's goal
  
  2. Security
    - No RLS changes needed as existing policies will work with new column
*/

-- Add department_id column
ALTER TABLE indicator_data_entries 
ADD COLUMN IF NOT EXISTS department_id uuid;

-- Add foreign key constraint
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'indicator_data_entries_department_id_fkey'
  ) THEN
    ALTER TABLE indicator_data_entries
    ADD CONSTRAINT indicator_data_entries_department_id_fkey
    FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_indicator_data_entries_department_id 
ON indicator_data_entries(department_id);

-- Populate department_id for existing records from indicator's goal
UPDATE indicator_data_entries ide
SET department_id = g.department_id
FROM indicators i
JOIN goals g ON i.goal_id = g.id
WHERE ide.indicator_id = i.id
  AND ide.department_id IS NULL;

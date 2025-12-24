/*
  # Add department field to objectives

  1. Changes
    - Add `department_id` column to objectives table
    - Add foreign key constraint to departments table
    - Update existing data to allow null (for objectives not yet assigned)

  2. Security
    - No RLS changes needed, existing policies will work with new column
*/

-- Add department_id column to objectives
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'objectives' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE objectives ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_objectives_department_id ON objectives(department_id);

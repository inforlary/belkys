/*
  # Add Category and Description to Project Files

  1. Changes
    - Add `category` column to project_files table
      - Values: 'contract', 'hakedis', 'report', 'photo', 'other'
    - Add `description` column for optional file descriptions
    - Create index on category for filtering

  2. Notes
    - Existing records will default to 'other' category
    - Description is optional
*/

-- Add category column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_files' AND column_name = 'category'
  ) THEN
    ALTER TABLE project_files ADD COLUMN category text DEFAULT 'other';
  END IF;
END $$;

-- Add description column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'project_files' AND column_name = 'description'
  ) THEN
    ALTER TABLE project_files ADD COLUMN description text;
  END IF;
END $$;

-- Create index on category for filtering
CREATE INDEX IF NOT EXISTS idx_project_files_category ON project_files(category);

-- Update existing photo records to have photo category
UPDATE project_files
SET category = 'photo'
WHERE file_type IN ('image/jpeg', 'image/png', 'image/jpg')
AND category = 'other';

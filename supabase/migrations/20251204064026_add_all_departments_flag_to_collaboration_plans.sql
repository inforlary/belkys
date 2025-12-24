/*
  # Add all_departments flag to collaboration plans

  1. Changes
    - Add `all_departments` boolean column to `collaboration_plans` table
    - Default value is false
    - When true, indicates that all departments are included in collaboration
  
  2. Purpose
    - Allow marking a collaboration plan as including all departments
    - Simplifies UI by showing "Tüm Birimler" instead of listing all departments
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'collaboration_plans' AND column_name = 'all_departments'
  ) THEN
    ALTER TABLE collaboration_plans 
    ADD COLUMN all_departments boolean DEFAULT false NOT NULL;
  END IF;
END $$;
/*
  # Add module_activity_reports to organizations table

  1. Changes
    - Add `module_activity_reports` (boolean) column to organizations table with default value true
  
  2. Notes
    - This column controls access to the Activity Reports module
    - Default value is true to enable the module for existing organizations
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'module_activity_reports'
  ) THEN
    ALTER TABLE organizations ADD COLUMN module_activity_reports boolean DEFAULT true NOT NULL;
  END IF;
END $$;

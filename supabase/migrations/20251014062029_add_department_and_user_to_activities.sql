/*
  # Add department and user assignment to activities

  1. Changes
    - Add department_id column to link activities to departments
    - Add assigned_user_id column to assign activities to specific users
    - Keep responsible_department for backwards compatibility
    - Add indexes for better performance

  2. Security
    - Foreign keys to ensure data integrity
    - Proper cascading on deletion
*/

-- Add department_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' AND column_name = 'department_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN department_id uuid REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add assigned_user_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'activities' AND column_name = 'assigned_user_id'
  ) THEN
    ALTER TABLE activities ADD COLUMN assigned_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_activities_department ON activities(department_id);
CREATE INDEX IF NOT EXISTS idx_activities_assigned_user ON activities(assigned_user_id);

-- Make responsible_department nullable since we now have department_id
ALTER TABLE activities ALTER COLUMN responsible_department DROP NOT NULL;

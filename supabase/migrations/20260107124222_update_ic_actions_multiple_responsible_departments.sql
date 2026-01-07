/*
  # Update IC Actions for Multiple Responsible Departments

  1. Changes
    - Add responsible_department_ids array column (replaces single responsible_department_id)
    - Add responsible_department_coordinators jsonb column {dept_id: user_id}
    - Add related_department_coordinators jsonb column {dept_id: user_id}
    - Migrate existing responsible_department_id data to responsible_department_ids

  2. Notes
    - Allows multiple responsible departments per action
    - Each department (responsible or related) can have an optional coordinator
*/

-- Add new columns
ALTER TABLE ic_actions ADD COLUMN IF NOT EXISTS responsible_department_ids uuid[] DEFAULT NULL;
ALTER TABLE ic_actions ADD COLUMN IF NOT EXISTS responsible_department_coordinators jsonb DEFAULT NULL;
ALTER TABLE ic_actions ADD COLUMN IF NOT EXISTS related_department_coordinators jsonb DEFAULT NULL;

-- Migrate existing data: convert single responsible_department_id to array
UPDATE ic_actions 
SET responsible_department_ids = ARRAY[responsible_department_id]
WHERE responsible_department_id IS NOT NULL AND responsible_department_ids IS NULL;

-- Keep responsible_department_id for backwards compatibility but make it nullable
-- Frontend will use responsible_department_ids array instead

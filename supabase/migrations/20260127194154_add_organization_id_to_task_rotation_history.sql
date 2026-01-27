/*
  # Add organization_id to task_rotation_history

  1. Changes
    - Add `organization_id` column to `task_rotation_history` table
    - Add foreign key constraint to organizations table
    - Add index for better query performance
    - Update existing records with organization_id from related sensitive_task
    
  2. Security
    - Update RLS policies to use organization_id for filtering
*/

-- Add organization_id column
ALTER TABLE task_rotation_history 
ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE;

-- Update existing records with organization_id from sensitive_tasks
UPDATE task_rotation_history rh
SET organization_id = st.organization_id
FROM sensitive_tasks st
WHERE rh.sensitive_task_id = st.id
  AND rh.organization_id IS NULL;

-- Make organization_id NOT NULL after updating existing records
ALTER TABLE task_rotation_history 
ALTER COLUMN organization_id SET NOT NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_task_rotation_history_organization_id 
ON task_rotation_history(organization_id);

-- Update RLS policies to use organization_id
DROP POLICY IF EXISTS "Users can view rotation history in their organization" ON task_rotation_history;
DROP POLICY IF EXISTS "Admins and directors can insert rotation history" ON task_rotation_history;

CREATE POLICY "Users can view rotation history in their organization"
  ON task_rotation_history FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and directors can insert rotation history"
  ON task_rotation_history FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'director', 'president', 'super_admin')
    )
  );
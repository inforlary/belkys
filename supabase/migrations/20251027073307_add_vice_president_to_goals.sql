/*
  # Add Vice President to Goals

  1. Changes
    - Add vice_president_id column to goals table
    - Add foreign key constraint to profiles table
    - Create index for performance queries
    - Update RLS policies to include vice president access

  2. Security
    - Vice presidents can view goals for their assigned departments
    - Maintains existing admin and department-based access
*/

-- Add vice_president_id column to goals table
ALTER TABLE goals 
ADD COLUMN IF NOT EXISTS vice_president_id uuid REFERENCES profiles(id);

-- Create index for performance queries
CREATE INDEX IF NOT EXISTS idx_goals_vice_president 
ON goals(vice_president_id);

-- Drop existing select policy
DROP POLICY IF EXISTS "select_goals" ON goals;

-- Recreate select policy with vice president access
CREATE POLICY "select_goals"
  ON goals
  FOR SELECT
  TO authenticated
  USING (
    organization_id = current_user_org()
    AND (
      -- Admin users can see all goals
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
        AND organization_id = current_user_org()
      )
      OR
      -- Vice presidents can see goals assigned to them
      vice_president_id = auth.uid()
      OR
      -- Department users can see their department's goals
      department_id = current_user_dept()
      OR
      -- Users assigned to activities under this goal
      EXISTS (
        SELECT 1 FROM activities a
        WHERE a.goal_id = goals.id
        AND a.assigned_user_id = auth.uid()
      )
    )
  );

-- Update the update policy to allow vice presidents to update their goals
DROP POLICY IF EXISTS "update_goals" ON goals;

CREATE POLICY "update_goals"
  ON goals
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = current_user_org()
    AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
        AND organization_id = current_user_org()
      )
      OR
      vice_president_id = auth.uid()
      OR
      department_id = current_user_dept()
    )
  )
  WITH CHECK (
    organization_id = current_user_org()
    AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
        AND organization_id = current_user_org()
      )
      OR
      vice_president_id = auth.uid()
      OR
      department_id = current_user_dept()
    )
  );

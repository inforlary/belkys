/*
  # Fix Indicator Data Entries RLS for Admin Users

  1. Changes
    - Drop existing "select_data_entries" policy
    - Create new policy that properly handles admin users without department checks
  
  2. Security
    - Admin users can see all data entries in their organization
    - Regular users can only see data entries for indicators in their department
    - Maintains organization-level isolation
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "select_data_entries" ON indicator_data_entries;

-- Create new policy with proper admin handling
CREATE POLICY "select_data_entries"
  ON indicator_data_entries
  FOR SELECT
  TO authenticated
  USING (
    organization_id = current_user_org()
    AND (
      -- Admins can see all entries in their organization
      is_admin()
      OR
      -- Regular users can see entries for indicators in their department
      indicator_id IN (
        SELECT i.id
        FROM indicators i
        JOIN goals g ON i.goal_id = g.id
        WHERE g.department_id = current_user_dept()
      )
    )
  );

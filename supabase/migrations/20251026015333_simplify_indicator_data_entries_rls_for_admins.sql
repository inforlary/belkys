/*
  # Simplify Indicator Data Entries RLS for Admin Users

  1. Changes
    - Drop existing "select_data_entries" policy
    - Create simplified policy that checks admin status first
    - Avoid NULL department issues for admin users
  
  2. Security
    - Admin users can see all data entries in their organization (no subquery)
    - Regular users can see entries for indicators in their department
    - Maintains organization-level isolation
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "select_data_entries" ON indicator_data_entries;

-- Create simplified policy with admin check first
CREATE POLICY "select_data_entries"
  ON indicator_data_entries
  FOR SELECT
  TO authenticated
  USING (
    organization_id = current_user_org()
    AND (
      -- Check if user is admin first (no department check needed)
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role = 'admin'
        AND organization_id = current_user_org()
      )
      OR
      -- Regular users: check department through indicator -> goal path
      EXISTS (
        SELECT 1
        FROM indicators i
        JOIN goals g ON i.goal_id = g.id
        JOIN profiles p ON p.id = auth.uid()
        WHERE i.id = indicator_data_entries.indicator_id
        AND g.department_id = p.department_id
      )
    )
  );

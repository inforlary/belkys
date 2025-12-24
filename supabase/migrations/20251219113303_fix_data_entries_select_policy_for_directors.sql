/*
  # Fix SELECT Policy for Indicator Data Entries

  1. Problem
    - Current SELECT policy only checks organization_id through indicators->goals
    - Directors cannot see entries in their department after page refresh
    - Data appears then disappears due to RLS filtering

  2. Solution
    - Update SELECT policy to include role-based access
    - Admins/VPs: see all entries in their organization
    - Directors: see entries in their department
    - Users: see entries for indicators in their department's goals

  3. Security
    - Maintain organization boundaries
    - Add department-level access control for directors
    - Keep existing user-level restrictions
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "select_data_entries" ON indicator_data_entries;

-- Create new comprehensive SELECT policy
CREATE POLICY "select_data_entries"
  ON indicator_data_entries
  FOR SELECT
  TO authenticated
  USING (
    -- Admins, vice presidents, and super admins can see all entries in their organization
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.organization_id = indicator_data_entries.organization_id
          AND profiles.role IN ('admin', 'vice_president', 'super_admin')
      )
    )
    OR
    -- Directors can see entries in their department
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.organization_id = indicator_data_entries.organization_id
          AND profiles.department_id = indicator_data_entries.department_id
          AND profiles.role = 'director'
      )
    )
    OR
    -- Regular users can see entries for indicators in their department's goals
    (
      EXISTS (
        SELECT 1
        FROM indicators
        JOIN goals ON goals.id = indicators.goal_id
        JOIN profiles ON profiles.id = auth.uid()
        WHERE indicators.id = indicator_data_entries.indicator_id
          AND profiles.organization_id = goals.organization_id
          AND (
            profiles.department_id = goals.department_id
            OR profiles.role IN ('admin', 'vice_president', 'super_admin')
          )
      )
    )
  );

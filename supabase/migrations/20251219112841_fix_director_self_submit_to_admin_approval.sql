/*
  # Fix Director Self-Submit to Admin Approval

  1. Problem
    - Directors who enter their own data cannot submit it directly to admin approval
    - The users_update_own_draft_entries policy only allows pending_director status
    - Directors need ability to submit their entries to pending_admin status

  2. Solution
    - Update users_update_own_draft_entries policy to allow directors to submit to pending_admin
    - Add conditional logic: regular users can only go to pending_director, directors can go to pending_admin
    - Keep security boundaries intact

  3. Security
    - Users can only update their own entries
    - Regular users: draft/rejected → pending_director
    - Directors: draft/rejected → pending_director OR pending_admin
    - Organization boundaries maintained
*/

-- Drop existing user update policy
DROP POLICY IF EXISTS "users_update_own_draft_entries" ON indicator_data_entries;

-- Recreate with director privileges
CREATE POLICY "users_update_own_draft_entries"
  ON indicator_data_entries
  FOR UPDATE
  TO authenticated
  USING (
    entered_by = auth.uid() 
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND status IN ('draft', 'rejected')
  )
  WITH CHECK (
    entered_by = auth.uid()
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND (
      -- Regular users can only submit to pending_director
      (status IN ('draft', 'rejected', 'pending_director') AND (SELECT role FROM profiles WHERE id = auth.uid()) NOT IN ('director', 'admin', 'vice_president', 'super_admin'))
      OR
      -- Directors and above can submit to pending_director or pending_admin
      (status IN ('draft', 'rejected', 'pending_director', 'pending_admin') AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('director', 'admin', 'vice_president', 'super_admin'))
    )
  );

-- Also update directors_update_entries to ensure they can update their own draft entries
DROP POLICY IF EXISTS "directors_update_entries" ON indicator_data_entries;

CREATE POLICY "directors_update_entries"
  ON indicator_data_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.organization_id = indicator_data_entries.organization_id
        AND profiles.department_id = indicator_data_entries.department_id
        AND profiles.role = 'director'
    )
    AND status IN ('draft', 'pending_director', 'pending_admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.organization_id = indicator_data_entries.organization_id
        AND profiles.department_id = indicator_data_entries.department_id
        AND profiles.role = 'director'
    )
    AND status IN ('draft', 'pending_director', 'pending_admin', 'approved', 'rejected')
  );

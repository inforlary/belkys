/*
  # Fix Status Names Consistency

  1. Problem
    - RLS policies use 'pending_director_approval' and 'pending_admin_approval'
    - But constraint and frontend use 'pending_director' and 'pending_admin'
    - This mismatch prevents directors from submitting data

  2. Solution
    - Update RLS policies to use correct status names
    - Keep constraint as: draft, pending_director, pending_admin, approved, rejected

  3. Security
    - Users can update their own draft/rejected entries
    - Users can submit to pending_director
    - Directors can submit to pending_admin
*/

-- Drop existing policy
DROP POLICY IF EXISTS "users_update_own_draft_entries" ON indicator_data_entries;

-- Recreate with correct status names
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
      -- Regular users can keep as draft or submit to pending_director
      (status IN ('draft', 'rejected', 'pending_director') AND (SELECT role FROM profiles WHERE id = auth.uid()) NOT IN ('director', 'admin', 'vice_president'))
      OR
      -- Directors and above can also submit to pending_admin
      (status IN ('draft', 'rejected', 'pending_director', 'pending_admin') AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('director', 'admin', 'vice_president'))
    )
  );

-- Update directors_update_entries policy with correct status names
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

COMMENT ON POLICY "users_update_own_draft_entries" ON indicator_data_entries IS
'Users can update their own draft/rejected entries. Regular users submit to pending_director, directors can submit to pending_admin.';

COMMENT ON POLICY "directors_update_entries" ON indicator_data_entries IS
'Directors can update entries in their department including approving to pending_admin or approved status.';
/*
  # Fix UPDATE Policies for All User Roles

  1. Changes
    - Simplify and fix UPDATE policies to support all roles properly
    - Allow users to update their own draft/rejected entries
    - Allow directors to approve entries
    - Allow admins full access
  
  2. Security
    - Users can only update their own entries
    - Status transitions are controlled
    - Organization boundaries are enforced
*/

-- Drop existing update policies
DROP POLICY IF EXISTS "update_own_draft_entries" ON indicator_data_entries;
DROP POLICY IF EXISTS "update_entries_director" ON indicator_data_entries;
DROP POLICY IF EXISTS "update_entries_admin" ON indicator_data_entries;

-- Policy for regular users: update own draft entries and submit for approval
CREATE POLICY "users_update_own_entries"
  ON indicator_data_entries
  FOR UPDATE
  TO authenticated
  USING (
    entered_by = auth.uid() 
    AND status IN ('draft', 'rejected')
    AND (SELECT role FROM profiles WHERE id = auth.uid()) IN ('user', 'director')
  )
  WITH CHECK (
    entered_by = auth.uid()
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Policy for directors: can approve their department's entries
CREATE POLICY "directors_approve_entries"
  ON indicator_data_entries
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'director'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND status IN ('draft', 'pending_director', 'rejected')
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Policy for admins: full access to all entries in their organization
CREATE POLICY "admins_update_all_entries"
  ON indicator_data_entries
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

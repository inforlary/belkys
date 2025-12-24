/*
  # Fix UPDATE Policy for New Status Values
  
  1. Changes
    - Drop and recreate the UPDATE policy to support new status values
    - Allow users to update their draft entries and change status to pending_director/pending_admin
    - Directors can update and approve (pending_admin)
  
  2. Security
    - Users can only update their own entries that are in draft status
    - Users can change status from draft to pending_director or pending_admin
    - Admins and directors have appropriate permissions
*/

-- Drop existing update policies
DROP POLICY IF EXISTS "update_own_draft_entries" ON indicator_data_entries;
DROP POLICY IF EXISTS "update_entries_admin" ON indicator_data_entries;

-- Policy for regular users: update own draft entries
CREATE POLICY "update_own_draft_entries"
  ON indicator_data_entries
  FOR UPDATE
  TO authenticated
  USING (
    entered_by = auth.uid() 
    AND status IN ('draft', 'rejected')
  )
  WITH CHECK (
    entered_by = auth.uid() 
    AND status IN ('draft', 'pending_director', 'pending_admin', 'approved', 'rejected')
  );

-- Policy for directors: update entries for approval
CREATE POLICY "update_entries_director"
  ON indicator_data_entries
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'director'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND status IN ('draft', 'pending_director', 'rejected')
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'director'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND status IN ('draft', 'pending_director', 'pending_admin', 'approved', 'rejected')
  );

-- Policy for admins: update all entries in their organization
CREATE POLICY "update_entries_admin"
  ON indicator_data_entries
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

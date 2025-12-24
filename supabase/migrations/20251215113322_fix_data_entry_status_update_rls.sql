/*
  # Fix Data Entry Status Update RLS

  1. Changes
    - Allow users to update their own draft entries to pending_director
    - Allow directors to update pending_director entries to pending_admin
    - Allow admins to update any entries in their organization
    
  2. Security
    - Users can only update their own draft/rejected entries
    - Users can change status to pending_director when submitting
    - Directors can update entries and change status appropriately
    - Admins have full control within their organization
*/

-- Drop existing update policies
DROP POLICY IF EXISTS "users_update_own_draft_entries" ON indicator_data_entries;
DROP POLICY IF EXISTS "directors_update_all_entries" ON indicator_data_entries;
DROP POLICY IF EXISTS "admins_update_all_entries" ON indicator_data_entries;

-- Policy for regular users: can update their own draft/rejected entries
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
    AND status IN ('draft', 'rejected', 'pending_director')
  );

-- Policy for directors: can update entries and change status
CREATE POLICY "directors_update_entries"
  ON indicator_data_entries
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'director'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
    AND status IN ('draft', 'rejected', 'pending_director', 'pending_admin', 'approved')
  );

-- Policy for admins and vice presidents: can update all entries in their organization
CREATE POLICY "admins_update_all_entries"
  ON indicator_data_entries
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'vice_president', 'super_admin')
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

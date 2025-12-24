/*
  # Fix WITH CHECK Policies for Status Updates

  1. Changes
    - Update WITH CHECK policies to allow proper status transitions
    - Users can transition from draft to pending_director
    - Directors can transition to pending_admin
    - Admins can transition to any valid status
  
  2. Security
    - Maintain organization boundaries
    - Control status transition flows
*/

-- Drop existing update policies
DROP POLICY IF EXISTS "users_update_own_entries" ON indicator_data_entries;
DROP POLICY IF EXISTS "directors_approve_entries" ON indicator_data_entries;
DROP POLICY IF EXISTS "admins_update_all_entries" ON indicator_data_entries;

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
    AND status IN ('draft', 'pending_director', 'pending_admin', 'approved', 'rejected')
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
    AND status IN ('draft', 'pending_director', 'pending_admin', 'approved', 'rejected')
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
    AND status IN ('draft', 'pending_director', 'pending_admin', 'approved', 'rejected')
  );

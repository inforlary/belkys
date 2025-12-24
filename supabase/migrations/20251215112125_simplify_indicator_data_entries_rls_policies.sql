/*
  # Simplify RLS Policies for indicator_data_entries

  1. Changes
    - Remove all existing UPDATE policies
    - Create simpler, more permissive policies
    - Allow users to update their own entries
    - Allow directors and admins to update all entries in their organization
  
  2. Security
    - Maintain organization boundaries
    - Allow proper status transitions
*/

-- Drop all existing UPDATE policies
DROP POLICY IF EXISTS "users_update_own_entries" ON indicator_data_entries;
DROP POLICY IF EXISTS "directors_approve_entries" ON indicator_data_entries;
DROP POLICY IF EXISTS "admins_update_all_entries" ON indicator_data_entries;

-- Simple policy: Users can update their own entries if status is draft or rejected
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
  );

-- Directors can update any entry in their organization
CREATE POLICY "directors_update_all_entries"
  ON indicator_data_entries
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'director'
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Admins and super_admins can update all entries in their organization
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

/*
  # Fix indicator_data_entries RLS policies for status updates

  1. Changes
    - Drop and recreate update policy for non-admin users
    - Allow users to update their own draft entries and change status to 'submitted'
    - Ensure with_check allows status change from draft to submitted
    - Keep admin policies unchanged for full control
  
  2. Security
    - Users can only update entries they created
    - Users can only update entries that are currently in 'draft' status
    - Users can change status to 'submitted' (for approval workflow)
    - Admins retain full update/delete access regardless of status
*/

-- Drop existing update policy for non-admin users
DROP POLICY IF EXISTS "update_own_draft_entries" ON indicator_data_entries;

-- Recreate update policy with proper with_check clause
CREATE POLICY "update_own_draft_entries"
  ON indicator_data_entries
  FOR UPDATE
  TO authenticated
  USING (
    entered_by = auth.uid() 
    AND status = 'draft'
  )
  WITH CHECK (
    entered_by = auth.uid()
    AND status IN ('draft', 'submitted')
  );

-- Drop and recreate delete policy to be more explicit
DROP POLICY IF EXISTS "delete_own_draft_entries" ON indicator_data_entries;

CREATE POLICY "delete_own_draft_entries"
  ON indicator_data_entries
  FOR DELETE
  TO authenticated
  USING (
    entered_by = auth.uid() 
    AND status = 'draft'
  );

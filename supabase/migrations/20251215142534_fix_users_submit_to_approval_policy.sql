/*
  # Fix Users Submit to Approval Policy

  1. Changes
    - Update users_update_own_draft_entries policy to allow status transition to pending_director
    - Users need to be able to submit their draft entries for director approval
    - Keep security boundaries intact

  2. Security
    - Users can only update their own entries
    - Can update when status is draft or rejected
    - Can transition to pending_director status for approval workflow
    - Maintain organization boundaries
*/

-- Drop existing user update policy
DROP POLICY IF EXISTS "users_update_own_draft_entries" ON indicator_data_entries;

-- Recreate with ability to submit for approval
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
/*
  # Fix Users Submit to Approval Policy
  
  1. Problem
    - Users cannot change status from 'draft' to 'pending_director_approval'
    - USING clause only allows updates when status = 'draft'
    - Missing WITH CHECK for valid status transitions
  
  2. Solution
    - Allow users to update their own entries when status is draft or rejected
    - Add WITH CHECK to allow valid status transitions
    - Allow transitions: draft -> pending_director_approval, rejected -> pending_director_approval
  
  3. Security
    - Users can only update their own entries
    - Can only submit from draft or rejected status
    - Can only transition to pending_director_approval status
*/

-- Drop existing policy
DROP POLICY IF EXISTS "users_update_own_draft_entries" ON indicator_data_entries;

-- Recreate with proper status transition support
CREATE POLICY "users_update_own_draft_entries"
  ON indicator_data_entries
  FOR UPDATE
  TO authenticated
  USING (
    entered_by = (SELECT auth.uid())
    AND status IN ('draft', 'rejected')
  )
  WITH CHECK (
    entered_by = (SELECT auth.uid())
    AND (
      -- Allow keeping as draft
      status = 'draft'
      -- Allow submitting to director approval
      OR status = 'pending_director_approval'
      -- Allow submitting directly to admin approval if user is director
      OR (
        status = 'pending_admin_approval'
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE id = (SELECT auth.uid())
          AND role = 'director'
        )
      )
    )
  );

COMMENT ON POLICY "users_update_own_draft_entries" ON indicator_data_entries IS
'Users can update their own draft/rejected entries and submit them for approval. Directors can also submit directly to admin approval.';

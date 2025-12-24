/*
  # Fix Directors Update Policy to Allow Draft Status Updates

  1. Changes
    - Update directors_update_entries policy to allow updating draft entries
    - Directors need to update draft entries in their department to pending_admin
    - Keep WITH CHECK to allow transitions to pending_admin

  2. Security
    - Directors can only update entries in their own department
    - Can update draft, pending_director, and pending_admin status entries
    - Target status must be valid approval workflow status
*/

-- Drop existing director update policy
DROP POLICY IF EXISTS "directors_update_entries" ON indicator_data_entries;

-- Recreate with ability to update draft entries
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
  AND status IN ('pending_director', 'pending_admin', 'approved')
);
/*
  # Fix Activity Justifications RLS for Users
  
  1. Changes
    - Drop and recreate INSERT policy to include users
    - Add UPDATE policy for users to update their own department's justifications
    
  2. Security
    - Users can create justifications for their own department
    - Users can update non-approved justifications for their own department
    - Maintains existing admin and manager permissions
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "Admins and managers can create justifications" ON activity_justifications;

-- Recreate INSERT policy with user support
CREATE POLICY "Admins, managers, and users can create justifications"
  ON activity_justifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = activity_justifications.organization_id
      AND (
        profiles.role = 'admin'
        OR (
          (profiles.role = 'manager' OR profiles.role = 'user')
          AND profiles.department_id = activity_justifications.department_id
        )
      )
    )
  );

-- Add UPDATE policy for users
CREATE POLICY "Users can update own department justifications"
  ON activity_justifications
  FOR UPDATE
  TO authenticated
  USING (
    status <> 'approved'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = activity_justifications.organization_id
      AND profiles.department_id = activity_justifications.department_id
      AND profiles.role = 'user'
    )
  );
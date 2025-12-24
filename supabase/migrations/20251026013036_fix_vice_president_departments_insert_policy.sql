/*
  # Fix Vice President Departments Insert Policy

  1. Changes
    - Update INSERT policy to only check the admin's organization_id
    - Remove dependency on the new vice president's profile during creation
    
  2. Security
    - Admins can insert records if they belong to the same organization
    - This allows creating departments for newly created vice presidents
*/

DROP POLICY IF EXISTS "Admins can insert vice president departments" ON vice_president_departments;

CREATE POLICY "Admins can insert vice president departments"
  ON vice_president_departments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

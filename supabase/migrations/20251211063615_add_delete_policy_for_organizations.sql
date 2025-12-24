/*
  # Add DELETE Policy for Organizations Table

  1. Problem
    - Organizations table has no DELETE policy
    - Super admins cannot delete organizations despite having INSERT, UPDATE, SELECT permissions
    - When RLS is enabled and no policy exists for an operation, that operation is blocked by default

  2. Changes
    - Add DELETE policy for super admins on organizations table
    
  3. Security
    - Only super admins can delete organizations
    - Regular users and admins cannot delete organizations
*/

-- Add DELETE policy for super admins
CREATE POLICY "Super admins can delete organizations"
  ON organizations
  FOR DELETE
  TO authenticated
  USING (is_super_admin());
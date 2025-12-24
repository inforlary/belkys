/*
  # Fix Profiles Delete Policy

  1. Changes
    - Drop the restrictive `prevent_delete_profile` policy that blocks all deletes
    - Add new policy allowing admins and super admins to delete profiles in their organization

  2. Security
    - Only admins and super admins can delete profiles
    - Admins can only delete profiles within their organization
    - Super admins can delete any profile
    - Users cannot delete their own profiles (must be done by admin)
*/

-- Drop the restrictive delete policy
DROP POLICY IF EXISTS "prevent_delete_profile" ON profiles;

-- Create new policy allowing admins to delete profiles in their organization
CREATE POLICY "Admins can delete profiles in organization"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    is_admin() 
    AND organization_id = current_user_org()
  );

-- Create policy allowing super admins to delete any profile
CREATE POLICY "Super admins can delete profiles"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (is_super_admin());
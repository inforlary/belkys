/*
  # Fix Profiles SELECT Policy for Quality Management

  1. Changes
    - Drop problematic policy that may cause infinite recursion
    - Create a simple, direct policy for organization members
    - Allow users to view other users in same organization

  2. Security
    - Super admins can view all profiles
    - Users can view profiles in their organization (without using helper function)
    - Users can view their own profile
*/

-- Drop existing policy
DROP POLICY IF EXISTS "super_admin_select_all_profiles" ON profiles;

-- Create new comprehensive policy without using current_user_org() to avoid recursion
CREATE POLICY "profiles_select_policy"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Super admins can see all profiles
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role = 'super_admin'
    )
    OR
    -- Users can see profiles in their organization
    organization_id IN (
      SELECT p.organization_id FROM profiles p
      WHERE p.id = auth.uid()
    )
    OR
    -- Users can always see their own profile
    id = auth.uid()
  );

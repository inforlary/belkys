/*
  # Clean Up Duplicate RLS Policies for Profiles

  1. Changes
    - Remove all old duplicate SELECT policies
    - Keep only the comprehensive super_admin_select_all_profiles policy

  2. Security
    - Super admins can view all profiles
    - Users can view profiles in their organization
    - Users can view their own profile
*/

-- Drop old/duplicate SELECT policies
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON profiles;
DROP POLICY IF EXISTS "select_own_profile" ON profiles;

-- Ensure the comprehensive policy exists
DROP POLICY IF EXISTS "super_admin_select_all_profiles" ON profiles;

CREATE POLICY "super_admin_select_all_profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin() OR
    (organization_id = current_user_org()) OR
    (id = auth.uid())
  );

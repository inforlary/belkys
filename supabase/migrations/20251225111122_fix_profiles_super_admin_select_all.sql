/*
  # Fix Profiles RLS for Super Admin Access

  1. Changes
    - Add super admin SELECT policy to view all profiles across organizations
    - This fixes the issue where super admins can't see organization users

  2. Security
    - Super admins can view all profiles
    - Regular users can only view profiles in their organization
*/

-- Drop potentially conflicting policies
DROP POLICY IF EXISTS "select_org_profiles" ON profiles;
DROP POLICY IF EXISTS "select_org_profiles_if_admin" ON profiles;

-- Create comprehensive SELECT policy
CREATE POLICY "super_admin_select_all_profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin() OR
    (organization_id = current_user_org()) OR
    (id = auth.uid())
  );

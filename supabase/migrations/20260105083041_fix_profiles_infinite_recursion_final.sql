/*
  # Fix Profiles Infinite Recursion

  ## Problem
  The `profiles_select_policy` has infinite recursion because it queries the `profiles` table
  within the policy itself, causing RLS to check the policy again infinitely.

  ## Solution
  Replace direct table queries with SECURITY DEFINER functions that bypass RLS:
  - Use `is_super_admin()` instead of querying profiles for super_admin role
  - Use `current_user_org()` instead of querying profiles for organization_id
  - Keep direct `id = auth.uid()` as it doesn't query profiles

  ## Changes
  - Drop and recreate `profiles_select_policy` with safe implementation
*/

DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;

CREATE POLICY "profiles_select_policy"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    is_super_admin() 
    OR organization_id = current_user_org()
    OR id = auth.uid()
  );

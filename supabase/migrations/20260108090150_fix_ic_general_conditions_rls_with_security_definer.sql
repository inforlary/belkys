/*
  # Fix IC General Conditions RLS - Root Cause Fix

  1. Problem
    - RLS policies checking profiles table causing infinite recursion
    - profiles table's own RLS uses helper functions that read profiles again
    - This creates a circular dependency blocking all INSERT operations

  2. Solution
    - Create SECURITY DEFINER helper functions to bypass RLS
    - Use these functions in ic_general_conditions policies
    - Simplify policy logic to avoid circular dependencies

  3. Details
    - get_user_role_and_org(): Returns user's role and organization safely
    - Policies use this function instead of direct profiles queries
    - This breaks the circular dependency chain
*/

-- Create helper function to get user context without triggering RLS
CREATE OR REPLACE FUNCTION get_user_role_and_org_for_ic()
RETURNS TABLE (user_role text, user_org uuid, is_super boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.role,
    p.organization_id,
    p.is_super_admin
  FROM profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
END;
$$;

-- Drop all existing policies
DROP POLICY IF EXISTS "Super admins can view all general conditions" ON ic_general_conditions;
DROP POLICY IF EXISTS "Super admins can insert general conditions" ON ic_general_conditions;
DROP POLICY IF EXISTS "Super admins can update general conditions" ON ic_general_conditions;
DROP POLICY IF EXISTS "Super admins can delete general conditions" ON ic_general_conditions;
DROP POLICY IF EXISTS "Users can view general conditions" ON ic_general_conditions;
DROP POLICY IF EXISTS "Admins can insert general conditions" ON ic_general_conditions;
DROP POLICY IF EXISTS "Admins can update general conditions" ON ic_general_conditions;
DROP POLICY IF EXISTS "Admins can delete general conditions" ON ic_general_conditions;

-- SELECT policies
CREATE POLICY "ic_general_conditions_select"
  ON ic_general_conditions
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL OR
    (SELECT is_super FROM get_user_role_and_org_for_ic()) = true OR
    (SELECT user_org FROM get_user_role_and_org_for_ic()) = organization_id
  );

-- INSERT policies
CREATE POLICY "ic_general_conditions_insert"
  ON ic_general_conditions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT is_super FROM get_user_role_and_org_for_ic()) = true OR
    (
      (SELECT user_org FROM get_user_role_and_org_for_ic()) = organization_id AND
      (SELECT user_role FROM get_user_role_and_org_for_ic()) IN ('ADMIN', 'DIRECTOR')
    )
  );

-- UPDATE policies
CREATE POLICY "ic_general_conditions_update"
  ON ic_general_conditions
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT is_super FROM get_user_role_and_org_for_ic()) = true OR
    (
      (SELECT user_org FROM get_user_role_and_org_for_ic()) = organization_id AND
      (SELECT user_role FROM get_user_role_and_org_for_ic()) IN ('ADMIN', 'DIRECTOR')
    )
  )
  WITH CHECK (
    (SELECT is_super FROM get_user_role_and_org_for_ic()) = true OR
    (
      (SELECT user_org FROM get_user_role_and_org_for_ic()) = organization_id AND
      (SELECT user_role FROM get_user_role_and_org_for_ic()) IN ('ADMIN', 'DIRECTOR')
    )
  );

-- DELETE policies
CREATE POLICY "ic_general_conditions_delete"
  ON ic_general_conditions
  FOR DELETE
  TO authenticated
  USING (
    (SELECT is_super FROM get_user_role_and_org_for_ic()) = true OR
    (
      (SELECT user_org FROM get_user_role_and_org_for_ic()) = organization_id AND
      (SELECT user_role FROM get_user_role_and_org_for_ic()) IN ('ADMIN', 'DIRECTOR')
    )
  );
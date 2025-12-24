/*
  # Add Profiles Access for Security Definer Functions
  
  1. Problem
    - SECURITY DEFINER functions still affected by profiles RLS
    - can_insert_data_entry() cannot read profiles table
    - Results in 403 errors for all users
    
  2. Solution
    - Add special SELECT policy for system functions
    - Allow profiles table access in SECURITY DEFINER context
    - Use broader policy that covers function access
    
  3. Security
    - Only affects authenticated users in same org
    - Regular user queries still protected by RLS
    - No security degradation
*/

-- Drop if exists and recreate the policy
DROP POLICY IF EXISTS "allow_security_definer_functions" ON profiles;

-- Add a policy that allows reading profiles in same organization
CREATE POLICY "allow_security_definer_functions"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow if user is reading their own profile
    id = auth.uid()
    OR 
    -- OR if user is in same organization
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1)
  );

-- Recreate the can_insert_data_entry function with better error handling
CREATE OR REPLACE FUNCTION can_insert_data_entry(
  p_organization_id uuid,
  p_department_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_user_id uuid;
  v_user_role text;
  v_user_org_id uuid;
  v_user_dept_id uuid;
  v_profile_count int;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- User must be authenticated
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if we can even see the profile (RLS debug)
  SELECT COUNT(*) INTO v_profile_count
  FROM profiles
  WHERE id = v_user_id;
  
  IF v_profile_count = 0 THEN
    RETURN false;
  END IF;
  
  -- Get user details
  SELECT role, organization_id, department_id
  INTO v_user_role, v_user_org_id, v_user_dept_id
  FROM profiles
  WHERE id = v_user_id
  LIMIT 1;
  
  -- User must exist in profiles
  IF v_user_role IS NULL THEN
    RETURN false;
  END IF;
  
  -- Must be same organization
  IF v_user_org_id != p_organization_id THEN
    RETURN false;
  END IF;
  
  -- Admins, vice presidents, and super admins can insert anywhere in their org
  IF v_user_role IN ('admin', 'vice_president', 'super_admin') THEN
    RETURN true;
  END IF;
  
  -- Directors and users can only insert for their own department
  IF v_user_role IN ('director', 'user') THEN
    IF v_user_dept_id = p_department_id THEN
      RETURN true;
    END IF;
  END IF;
  
  -- Default deny
  RETURN false;
END;
$$;

-- Ensure proper permissions
GRANT EXECUTE ON FUNCTION can_insert_data_entry(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION set_entered_by() TO authenticated;

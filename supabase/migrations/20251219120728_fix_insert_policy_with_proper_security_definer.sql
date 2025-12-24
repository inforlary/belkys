/*
  # Fix INSERT Policy with Proper Security Definer Function
  
  1. Root Cause
    - INSERT policy queries profiles table directly
    - profiles table has its own RLS policies
    - This creates a circular dependency/conflict
    
  2. Solution
    - Use SECURITY DEFINER function that bypasses profiles RLS
    - Function does all authorization checks
    - Policy simply calls the function
    
  3. Security
    - All authorization logic in one secure function
    - Cannot be bypassed or manipulated
    - Clear audit trail
*/

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS can_insert_data_entry(uuid, uuid);

-- Create security definer function for insert permission check
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
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  -- User must be authenticated
  IF v_user_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get user details (SECURITY DEFINER bypasses RLS)
  SELECT role, organization_id, department_id
  INTO v_user_role, v_user_org_id, v_user_dept_id
  FROM profiles
  WHERE id = v_user_id;
  
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

-- Drop and recreate INSERT policy using the security definer function
DROP POLICY IF EXISTS "insert_data_entries" ON indicator_data_entries;

CREATE POLICY "insert_data_entries"
  ON indicator_data_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NOT NULL
    AND department_id IS NOT NULL
    AND can_insert_data_entry(organization_id, department_id)
  );

-- Grant execute permission
GRANT EXECUTE ON FUNCTION can_insert_data_entry(uuid, uuid) TO authenticated;

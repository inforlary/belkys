/*
  # Fix INSERT Policy with Security Definer Function

  1. Problem
    - INSERT policy for indicator_data_entries fails because it queries profiles table
    - profiles table has its own RLS policies that prevent the query from succeeding
    - Users and directors cannot insert data entries even with correct permissions

  2. Solution
    - Create a security definer function that bypasses RLS to check user permissions
    - Update INSERT policy to use this function
    - Maintain security by keeping all authorization logic in the function

  3. Security
    - Function runs with elevated privileges but only returns true/false
    - All authorization checks remain strict and validated
    - Organization and department boundaries are enforced
*/

-- Create security definer function to check insert permissions
CREATE OR REPLACE FUNCTION check_data_entry_insert_permission(
  p_organization_id uuid,
  p_department_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
  v_user_org_id uuid;
  v_user_dept_id uuid;
BEGIN
  -- Get user info from profiles (bypassing RLS with SECURITY DEFINER)
  SELECT role, organization_id, department_id
  INTO v_user_role, v_user_org_id, v_user_dept_id
  FROM profiles
  WHERE id = auth.uid();

  -- User must exist
  IF v_user_role IS NULL THEN
    RETURN false;
  END IF;

  -- Must be in same organization
  IF v_user_org_id != p_organization_id THEN
    RETURN false;
  END IF;

  -- Admins, vice presidents, and super admins can insert for any department
  IF v_user_role IN ('admin', 'vice_president', 'super_admin') THEN
    RETURN true;
  END IF;

  -- Directors and users can only insert for their own department
  IF v_user_role IN ('director', 'user') AND v_user_dept_id = p_department_id THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "insert_data_entries" ON indicator_data_entries;

-- Create new INSERT policy using the security definer function
CREATE POLICY "insert_data_entries"
  ON indicator_data_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    entered_by = auth.uid()
    AND organization_id IS NOT NULL
    AND department_id IS NOT NULL
    AND check_data_entry_insert_permission(organization_id, department_id)
  );

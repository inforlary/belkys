/*
  # Add function to get users for sensitive task assignment

  1. New Functions
    - `get_users_for_sensitive_task` - Returns users for a specific department or organization
      - Bypasses RLS to allow admins and directors to see all users in target department
      - Security definer function that checks user permissions

  2. Security
    - Function checks if user is admin, president, or director
    - Only returns users from same organization
    - Filters by department if specified
*/

-- Function to get users for sensitive task assignment
CREATE OR REPLACE FUNCTION get_users_for_sensitive_task(
  p_organization_id uuid,
  p_department_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  role text,
  department_id uuid,
  department_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_role text;
  v_user_org_id uuid;
BEGIN
  -- Get the current user's role and organization
  SELECT p.role, p.organization_id
  INTO v_user_role, v_user_org_id
  FROM profiles p
  WHERE p.id = auth.uid();

  -- Check if user has permission
  IF v_user_role NOT IN ('admin', 'president', 'director', 'super_admin') THEN
    RAISE EXCEPTION 'Insufficient permissions';
  END IF;

  -- Super admin can access any organization
  IF v_user_role = 'super_admin' THEN
    v_user_org_id := p_organization_id;
  ELSIF v_user_org_id != p_organization_id THEN
    RAISE EXCEPTION 'Cannot access users from different organization';
  END IF;

  -- Return users based on department filter
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.role,
    p.department_id,
    d.name as department_name
  FROM profiles p
  LEFT JOIN departments d ON d.id = p.department_id
  WHERE p.organization_id = p_organization_id
    AND (p_department_id IS NULL OR p.department_id = p_department_id)
  ORDER BY p.full_name;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_users_for_sensitive_task(uuid, uuid) TO authenticated;
/*
  # Fix Data Requests RLS - Correct Order

  1. Changes
    - First drop all policies that depend on the function
    - Then drop and recreate the function with RLS bypass
    - Finally recreate all policies
    
  2. Security
    - SECURITY DEFINER with row_security OFF to prevent recursion
    - Same access control logic maintained
*/

-- First: Drop all existing policies on data request tables
DROP POLICY IF EXISTS "data_requests_super_admin_all" ON data_requests;
DROP POLICY IF EXISTS "data_requests_admin_all" ON data_requests;
DROP POLICY IF EXISTS "data_requests_user_select" ON data_requests;

DROP POLICY IF EXISTS "assignments_super_admin_all" ON data_request_assignments;
DROP POLICY IF EXISTS "assignments_admin_all" ON data_request_assignments;
DROP POLICY IF EXISTS "assignments_user_select" ON data_request_assignments;
DROP POLICY IF EXISTS "assignments_user_update" ON data_request_assignments;

DROP POLICY IF EXISTS "submissions_super_admin_all" ON data_request_submissions;
DROP POLICY IF EXISTS "submissions_admin_select" ON data_request_submissions;
DROP POLICY IF EXISTS "submissions_admin_update" ON data_request_submissions;
DROP POLICY IF EXISTS "submissions_user_all" ON data_request_submissions;

DROP POLICY IF EXISTS "submission_values_super_admin_all" ON data_request_submission_values;
DROP POLICY IF EXISTS "submission_values_admin_select" ON data_request_submission_values;
DROP POLICY IF EXISTS "submission_values_user_all" ON data_request_submission_values;

DROP POLICY IF EXISTS "custom_fields_super_admin_all" ON data_request_custom_fields;
DROP POLICY IF EXISTS "custom_fields_admin_all" ON data_request_custom_fields;
DROP POLICY IF EXISTS "custom_fields_user_select" ON data_request_custom_fields;

-- Second: Drop and recreate the function
DROP FUNCTION IF EXISTS get_user_org_and_role();

CREATE OR REPLACE FUNCTION get_user_org_and_role()
RETURNS TABLE (org_id uuid, user_role text, dept_id uuid, is_super_admin boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET LOCAL row_security = off;
  
  RETURN QUERY
  SELECT 
    p.organization_id,
    p.role,
    p.department_id,
    p.is_super_admin
  FROM profiles p
  WHERE p.id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_org_and_role() TO authenticated;

-- Third: Recreate simplified policies for data_requests
CREATE POLICY "data_requests_access"
  ON data_requests FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR (u.org_id = organization_id AND u.user_role IN ('admin', 'director'))
         OR id IN (
           SELECT request_id FROM data_request_assignments
           WHERE assigned_to = auth.uid() OR department_id = u.dept_id
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR (u.org_id = organization_id AND u.user_role IN ('admin', 'director'))
    )
  );

-- Recreate policies for data_request_assignments
CREATE POLICY "assignments_access"
  ON data_request_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR assigned_to = auth.uid()
         OR department_id = u.dept_id
         OR EXISTS (
           SELECT 1 FROM data_requests dr
           WHERE dr.id = request_id
             AND dr.organization_id = u.org_id
             AND u.user_role IN ('admin', 'director')
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR assigned_to = auth.uid()
         OR department_id = u.dept_id
         OR EXISTS (
           SELECT 1 FROM data_requests dr
           WHERE dr.id = request_id
             AND dr.organization_id = u.org_id
             AND u.user_role IN ('admin', 'director')
         )
    )
  );

-- Recreate policies for data_request_submissions
CREATE POLICY "submissions_access"
  ON data_request_submissions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR submitted_by = auth.uid()
         OR department_id = u.dept_id
         OR EXISTS (
           SELECT 1 FROM data_requests dr
           WHERE dr.id = request_id
             AND dr.organization_id = u.org_id
             AND u.user_role IN ('admin', 'director')
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR submitted_by = auth.uid()
         OR department_id = u.dept_id
         OR EXISTS (
           SELECT 1 FROM data_requests dr
           WHERE dr.id = request_id
             AND dr.organization_id = u.org_id
             AND u.user_role IN ('admin', 'director')
         )
    )
  );

-- Recreate policies for data_request_submission_values
CREATE POLICY "submission_values_access"
  ON data_request_submission_values FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR EXISTS (
           SELECT 1 FROM data_request_submissions s
           WHERE s.id = submission_id
             AND (s.submitted_by = auth.uid() OR s.department_id = u.dept_id)
         )
         OR EXISTS (
           SELECT 1 FROM data_request_submissions s
           JOIN data_requests dr ON dr.id = s.request_id
           WHERE s.id = submission_id
             AND dr.organization_id = u.org_id
             AND u.user_role IN ('admin', 'director')
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR EXISTS (
           SELECT 1 FROM data_request_submissions s
           WHERE s.id = submission_id
             AND (s.submitted_by = auth.uid() OR s.department_id = u.dept_id)
         )
         OR EXISTS (
           SELECT 1 FROM data_request_submissions s
           JOIN data_requests dr ON dr.id = s.request_id
           WHERE s.id = submission_id
             AND dr.organization_id = u.org_id
             AND u.user_role IN ('admin', 'director')
         )
    )
  );

-- Recreate policies for data_request_custom_fields
CREATE POLICY "custom_fields_access"
  ON data_request_custom_fields FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR EXISTS (
           SELECT 1 FROM data_requests dr
           WHERE dr.id = request_id
             AND (dr.organization_id = u.org_id)
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR EXISTS (
           SELECT 1 FROM data_requests dr
           WHERE dr.id = request_id
             AND dr.organization_id = u.org_id
             AND u.user_role IN ('admin', 'director')
         )
    )
  );
/*
  # Fix Data Requests RLS Infinite Recursion

  1. Changes
    - Drop existing problematic RLS policies for data_requests and related tables
    - Create new simplified policies using security definer functions
    - Avoid circular references to profiles table
    
  2. Security
    - Maintain same access control logic
    - Use helper functions to avoid recursion
*/

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "Super admins have full access to requests" ON data_requests;
DROP POLICY IF EXISTS "Admins can manage requests in their org" ON data_requests;
DROP POLICY IF EXISTS "Users can view requests assigned to them" ON data_requests;

DROP POLICY IF EXISTS "Super admins have full access to assignments" ON data_request_assignments;
DROP POLICY IF EXISTS "Admins can manage assignments in their org" ON data_request_assignments;
DROP POLICY IF EXISTS "Users can view and update their assignments" ON data_request_assignments;
DROP POLICY IF EXISTS "Users can update their assignment status" ON data_request_assignments;

DROP POLICY IF EXISTS "Super admins have full access to submissions" ON data_request_submissions;
DROP POLICY IF EXISTS "Admins can view submissions in their org" ON data_request_submissions;
DROP POLICY IF EXISTS "Users can manage their own submissions" ON data_request_submissions;
DROP POLICY IF EXISTS "Admins can update submission status" ON data_request_submissions;

DROP POLICY IF EXISTS "Super admins have full access to submission values" ON data_request_submission_values;
DROP POLICY IF EXISTS "Users can view values of accessible submissions" ON data_request_submission_values;
DROP POLICY IF EXISTS "Users can manage values of their submissions" ON data_request_submission_values;

DROP POLICY IF EXISTS "Super admins have full access to custom fields" ON data_request_custom_fields;
DROP POLICY IF EXISTS "Users can view custom fields of accessible requests" ON data_request_custom_fields;
DROP POLICY IF EXISTS "Admins can manage custom fields in their org" ON data_request_custom_fields;

-- Create security definer function to get user context
CREATE OR REPLACE FUNCTION get_user_org_and_role()
RETURNS TABLE (org_id uuid, user_role text, dept_id uuid, is_super_admin boolean)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT 
    organization_id,
    role,
    department_id,
    is_super_admin
  FROM profiles
  WHERE id = auth.uid();
$$;

-- Data Requests Policies
CREATE POLICY "data_requests_super_admin_all"
  ON data_requests FOR ALL
  TO authenticated
  USING (
    (SELECT is_super_admin FROM get_user_org_and_role()) = true
  );

CREATE POLICY "data_requests_admin_all"
  ON data_requests FOR ALL
  TO authenticated
  USING (
    organization_id = (SELECT org_id FROM get_user_org_and_role())
    AND (SELECT user_role FROM get_user_org_and_role()) IN ('admin', 'director')
  );

CREATE POLICY "data_requests_user_select"
  ON data_requests FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT request_id FROM data_request_assignments
      WHERE assigned_to = auth.uid()
      OR department_id = (SELECT dept_id FROM get_user_org_and_role())
    )
  );

-- Assignments Policies
CREATE POLICY "assignments_super_admin_all"
  ON data_request_assignments FOR ALL
  TO authenticated
  USING (
    (SELECT is_super_admin FROM get_user_org_and_role()) = true
  );

CREATE POLICY "assignments_admin_all"
  ON data_request_assignments FOR ALL
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM data_requests
      WHERE organization_id = (SELECT org_id FROM get_user_org_and_role())
    )
    AND (SELECT user_role FROM get_user_org_and_role()) IN ('admin', 'director')
  );

CREATE POLICY "assignments_user_select"
  ON data_request_assignments FOR SELECT
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR department_id = (SELECT dept_id FROM get_user_org_and_role())
  );

CREATE POLICY "assignments_user_update"
  ON data_request_assignments FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid()
    OR department_id = (SELECT dept_id FROM get_user_org_and_role())
  )
  WITH CHECK (
    assigned_to = auth.uid()
    OR department_id = (SELECT dept_id FROM get_user_org_and_role())
  );

-- Submissions Policies
CREATE POLICY "submissions_super_admin_all"
  ON data_request_submissions FOR ALL
  TO authenticated
  USING (
    (SELECT is_super_admin FROM get_user_org_and_role()) = true
  );

CREATE POLICY "submissions_admin_select"
  ON data_request_submissions FOR SELECT
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM data_requests
      WHERE organization_id = (SELECT org_id FROM get_user_org_and_role())
    )
    AND (SELECT user_role FROM get_user_org_and_role()) IN ('admin', 'director')
  );

CREATE POLICY "submissions_admin_update"
  ON data_request_submissions FOR UPDATE
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM data_requests
      WHERE organization_id = (SELECT org_id FROM get_user_org_and_role())
    )
    AND (SELECT user_role FROM get_user_org_and_role()) IN ('admin', 'director')
  )
  WITH CHECK (
    request_id IN (
      SELECT id FROM data_requests
      WHERE organization_id = (SELECT org_id FROM get_user_org_and_role())
    )
  );

CREATE POLICY "submissions_user_all"
  ON data_request_submissions FOR ALL
  TO authenticated
  USING (
    submitted_by = auth.uid()
    OR department_id = (SELECT dept_id FROM get_user_org_and_role())
  )
  WITH CHECK (
    submitted_by = auth.uid()
    OR department_id = (SELECT dept_id FROM get_user_org_and_role())
  );

-- Submission Values Policies
CREATE POLICY "submission_values_super_admin_all"
  ON data_request_submission_values FOR ALL
  TO authenticated
  USING (
    (SELECT is_super_admin FROM get_user_org_and_role()) = true
  );

CREATE POLICY "submission_values_admin_select"
  ON data_request_submission_values FOR SELECT
  TO authenticated
  USING (
    submission_id IN (
      SELECT id FROM data_request_submissions
      WHERE request_id IN (
        SELECT id FROM data_requests
        WHERE organization_id = (SELECT org_id FROM get_user_org_and_role())
      )
    )
    AND (SELECT user_role FROM get_user_org_and_role()) IN ('admin', 'director')
  );

CREATE POLICY "submission_values_user_all"
  ON data_request_submission_values FOR ALL
  TO authenticated
  USING (
    submission_id IN (
      SELECT id FROM data_request_submissions
      WHERE submitted_by = auth.uid()
      OR department_id = (SELECT dept_id FROM get_user_org_and_role())
    )
  )
  WITH CHECK (
    submission_id IN (
      SELECT id FROM data_request_submissions
      WHERE submitted_by = auth.uid()
      OR department_id = (SELECT dept_id FROM get_user_org_and_role())
    )
  );

-- Custom Fields Policies
CREATE POLICY "custom_fields_super_admin_all"
  ON data_request_custom_fields FOR ALL
  TO authenticated
  USING (
    (SELECT is_super_admin FROM get_user_org_and_role()) = true
  );

CREATE POLICY "custom_fields_admin_all"
  ON data_request_custom_fields FOR ALL
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM data_requests
      WHERE organization_id = (SELECT org_id FROM get_user_org_and_role())
    )
    AND (SELECT user_role FROM get_user_org_and_role()) IN ('admin', 'director')
  );

CREATE POLICY "custom_fields_user_select"
  ON data_request_custom_fields FOR SELECT
  TO authenticated
  USING (
    request_id IN (
      SELECT id FROM data_requests
      WHERE organization_id = (SELECT org_id FROM get_user_org_and_role())
    )
  );
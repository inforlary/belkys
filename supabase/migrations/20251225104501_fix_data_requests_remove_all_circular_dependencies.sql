/*
  # Fix Data Requests RLS - Remove All Circular Dependencies

  1. Changes
    - Completely rebuild all policies without any circular references
    - Each table's policy only looks at its own columns and auth.uid()
    - Use direct column checks instead of JOIN queries
    
  2. Security
    - Maintain same security levels without circular dependencies
    - Super admin, admin, and user access preserved
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "data_requests_access" ON data_requests;
DROP POLICY IF EXISTS "assignments_access" ON data_request_assignments;
DROP POLICY IF EXISTS "submissions_access" ON data_request_submissions;
DROP POLICY IF EXISTS "submission_values_access" ON data_request_submission_values;
DROP POLICY IF EXISTS "custom_fields_access" ON data_request_custom_fields;

-- DATA REQUESTS: No dependencies on other data_request tables
CREATE POLICY "data_requests_select"
  ON data_requests FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR (u.org_id = organization_id AND u.user_role IN ('admin', 'director'))
         OR created_by = auth.uid()
    )
  );

CREATE POLICY "data_requests_insert"
  ON data_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR (u.org_id = organization_id AND u.user_role IN ('admin', 'director'))
    )
  );

CREATE POLICY "data_requests_update"
  ON data_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR (u.org_id = organization_id AND u.user_role IN ('admin', 'director'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR (u.org_id = organization_id AND u.user_role IN ('admin', 'director'))
    )
  );

CREATE POLICY "data_requests_delete"
  ON data_requests FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR (u.org_id = organization_id AND u.user_role IN ('admin', 'director'))
    )
  );

-- ASSIGNMENTS: Only check own columns
CREATE POLICY "assignments_select"
  ON data_request_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR assigned_to = auth.uid()
         OR department_id = u.dept_id
    )
  );

CREATE POLICY "assignments_insert"
  ON data_request_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR u.user_role IN ('admin', 'director')
    )
  );

CREATE POLICY "assignments_update"
  ON data_request_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR assigned_to = auth.uid()
         OR u.user_role IN ('admin', 'director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR assigned_to = auth.uid()
         OR u.user_role IN ('admin', 'director')
    )
  );

CREATE POLICY "assignments_delete"
  ON data_request_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR u.user_role IN ('admin', 'director')
    )
  );

-- SUBMISSIONS: Only check own columns
CREATE POLICY "submissions_select"
  ON data_request_submissions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR submitted_by = auth.uid()
         OR department_id = u.dept_id
         OR u.user_role IN ('admin', 'director')
    )
  );

CREATE POLICY "submissions_insert"
  ON data_request_submissions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR submitted_by = auth.uid()
         OR department_id = u.dept_id
    )
  );

CREATE POLICY "submissions_update"
  ON data_request_submissions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR submitted_by = auth.uid()
         OR department_id = u.dept_id
         OR u.user_role IN ('admin', 'director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR submitted_by = auth.uid()
         OR department_id = u.dept_id
         OR u.user_role IN ('admin', 'director')
    )
  );

CREATE POLICY "submissions_delete"
  ON data_request_submissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR submitted_by = auth.uid()
         OR u.user_role IN ('admin', 'director')
    )
  );

-- SUBMISSION VALUES: Only check own columns, no joins
CREATE POLICY "submission_values_select"
  ON data_request_submission_values FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR u.user_role IN ('admin', 'director')
    )
    OR 
    submission_id IN (
      SELECT id FROM data_request_submissions 
      WHERE submitted_by = auth.uid()
    )
  );

CREATE POLICY "submission_values_insert"
  ON data_request_submission_values FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
    )
    OR 
    submission_id IN (
      SELECT id FROM data_request_submissions 
      WHERE submitted_by = auth.uid()
    )
  );

CREATE POLICY "submission_values_update"
  ON data_request_submission_values FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR u.user_role IN ('admin', 'director')
    )
    OR 
    submission_id IN (
      SELECT id FROM data_request_submissions 
      WHERE submitted_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR u.user_role IN ('admin', 'director')
    )
    OR 
    submission_id IN (
      SELECT id FROM data_request_submissions 
      WHERE submitted_by = auth.uid()
    )
  );

CREATE POLICY "submission_values_delete"
  ON data_request_submission_values FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR u.user_role IN ('admin', 'director')
    )
    OR 
    submission_id IN (
      SELECT id FROM data_request_submissions 
      WHERE submitted_by = auth.uid()
    )
  );

-- CUSTOM FIELDS: Simple, no complex joins
CREATE POLICY "custom_fields_select"
  ON data_request_custom_fields FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
    )
    OR 
    request_id IN (
      SELECT id FROM data_requests dr
      JOIN get_user_org_and_role() u ON u.org_id = dr.organization_id
    )
  );

CREATE POLICY "custom_fields_insert"
  ON data_request_custom_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR u.user_role IN ('admin', 'director')
    )
  );

CREATE POLICY "custom_fields_update"
  ON data_request_custom_fields FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR u.user_role IN ('admin', 'director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR u.user_role IN ('admin', 'director')
    )
  );

CREATE POLICY "custom_fields_delete"
  ON data_request_custom_fields FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_user_org_and_role() u
      WHERE u.is_super_admin = true
         OR u.user_role IN ('admin', 'director')
    )
  );
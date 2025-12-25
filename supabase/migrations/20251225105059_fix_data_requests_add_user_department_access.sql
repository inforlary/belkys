/*
  # Fix Data Requests - Add User Department Access

  1. Changes
    - Add policy for regular users to view requests assigned to their department
    - Users can now see requests where their department_id matches an assignment
    
  2. Security
    - Maintains existing admin/director access
    - Adds read-only access for users to their department's requests
*/

-- Add policy for users to view requests assigned to their department
CREATE POLICY "users_view_department_requests"
  ON data_requests FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT dra.request_id 
      FROM data_request_assignments dra
      JOIN get_user_org_and_role() u ON u.dept_id = dra.department_id
    )
  );
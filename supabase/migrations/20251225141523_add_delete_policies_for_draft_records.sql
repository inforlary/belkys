/*
  # Add Delete Policies for Draft Records
  
  1. Changes
    - Allow users to delete their own draft activity justifications
    - Allow users to delete their own draft indicator mappings
    - Allow directors to delete draft records in their department
    - Maintain existing admin delete policies
  
  2. Security
    - Users can only delete their own draft records
    - Directors can delete draft records in their department
    - Admins and super admins can delete any records
*/

-- Activity Justifications: Add user delete policy
DROP POLICY IF EXISTS "Users can delete own draft justifications" ON activity_justifications;
CREATE POLICY "Users can delete own draft justifications"
  ON activity_justifications
  FOR DELETE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    AND status = 'draft'
  );

-- Activity Justifications: Add director delete policy
DROP POLICY IF EXISTS "Directors can delete draft justifications" ON activity_justifications;
CREATE POLICY "Directors can delete draft justifications"
  ON activity_justifications
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role = 'director'
      AND p.organization_id = activity_justifications.organization_id
      AND (
        activity_justifications.department_id = p.department_id
        OR activity_justifications.department_id IS NULL
      )
    )
    AND status IN ('draft', 'pending_vp_approval', 'vp_rejected')
  );

-- Program Activity Indicator Mappings: Add user delete policy
DROP POLICY IF EXISTS "Users can delete own draft mappings" ON program_activity_indicator_mappings;
CREATE POLICY "Users can delete own draft mappings"
  ON program_activity_indicator_mappings
  FOR DELETE
  TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    AND description_status = 'draft'
  );

-- Program Activity Indicator Mappings: Add director delete policy
DROP POLICY IF EXISTS "Directors can delete draft mappings" ON program_activity_indicator_mappings;
CREATE POLICY "Directors can delete draft mappings"
  ON program_activity_indicator_mappings
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (SELECT auth.uid())
      AND p.role = 'director'
      AND p.organization_id = program_activity_indicator_mappings.organization_id
      AND (
        program_activity_indicator_mappings.department_id = p.department_id
        OR program_activity_indicator_mappings.department_id IS NULL
      )
    )
    AND description_status IN ('draft', 'pending_director_approval', 'rejected')
  );

COMMENT ON POLICY "Users can delete own draft justifications" ON activity_justifications IS
'Users can delete their own draft activity justifications';

COMMENT ON POLICY "Directors can delete draft justifications" ON activity_justifications IS
'Directors can delete draft and pending justifications in their department';

COMMENT ON POLICY "Users can delete own draft mappings" ON program_activity_indicator_mappings IS
'Users can delete their own draft indicator mappings';

COMMENT ON POLICY "Directors can delete draft mappings" ON program_activity_indicator_mappings IS
'Directors can delete draft and pending mappings in their department';

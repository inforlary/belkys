/*
  # Fix Sub-Programs RLS for Super Admin

  1. Changes
    - Add Super Admin policies for sub_programs table to allow creating global standard codes (organization_id: null)
    - Add Super Admin policies for sub_program_activities table
    - Allow Super Admins to view, insert, update, and delete global standard codes
    
  2. Security
    - Only users with is_super_admin = true can manage global standard codes
    - Regular users cannot access global standard codes
*/

-- Drop existing overlapping policies if any
DROP POLICY IF EXISTS "Super Admins can view all sub_programs" ON sub_programs;
DROP POLICY IF EXISTS "Super Admins can insert global sub_programs" ON sub_programs;
DROP POLICY IF EXISTS "Super Admins can update global sub_programs" ON sub_programs;
DROP POLICY IF EXISTS "Super Admins can delete global sub_programs" ON sub_programs;

-- Super Admin policies for sub_programs
CREATE POLICY "Super Admins can view all sub_programs"
  ON sub_programs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super Admins can insert global sub_programs"
  ON sub_programs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IS NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super Admins can update global sub_programs"
  ON sub_programs
  FOR UPDATE
  TO authenticated
  USING (
    organization_id IS NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  )
  WITH CHECK (
    organization_id IS NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super Admins can delete global sub_programs"
  ON sub_programs
  FOR DELETE
  TO authenticated
  USING (
    organization_id IS NULL
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

-- Drop existing overlapping policies for sub_program_activities if any
DROP POLICY IF EXISTS "Super Admins can view all sub_program_activities" ON sub_program_activities;
DROP POLICY IF EXISTS "Super Admins can insert sub_program_activities" ON sub_program_activities;
DROP POLICY IF EXISTS "Super Admins can update sub_program_activities" ON sub_program_activities;
DROP POLICY IF EXISTS "Super Admins can delete sub_program_activities" ON sub_program_activities;

-- Super Admin policies for sub_program_activities
CREATE POLICY "Super Admins can view all sub_program_activities"
  ON sub_program_activities
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super Admins can insert sub_program_activities"
  ON sub_program_activities
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sub_programs
      WHERE sub_programs.id = sub_program_id
      AND sub_programs.organization_id IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super Admins can update sub_program_activities"
  ON sub_program_activities
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sub_programs
      WHERE sub_programs.id = sub_program_id
      AND sub_programs.organization_id IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sub_programs
      WHERE sub_programs.id = sub_program_id
      AND sub_programs.organization_id IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

CREATE POLICY "Super Admins can delete sub_program_activities"
  ON sub_program_activities
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sub_programs
      WHERE sub_programs.id = sub_program_id
      AND sub_programs.organization_id IS NULL
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

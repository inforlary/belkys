/*
  # Fix Vice President Departments RLS Policies

  1. Changes
    - Drop existing policies
    - Create separate policies for SELECT, INSERT, UPDATE, DELETE
    - Ensure admins can insert records for vice presidents
    
  2. Security
    - Admins can manage all operations
    - Vice presidents can only view their assigned departments
*/

DROP POLICY IF EXISTS "Admins can manage vice president departments" ON vice_president_departments;
DROP POLICY IF EXISTS "Vice presidents can view their departments" ON vice_president_departments;

CREATE POLICY "Admins can view vice president departments"
  ON vice_president_departments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id = vice_president_departments.organization_id
    )
  );

CREATE POLICY "Admins can insert vice president departments"
  ON vice_president_departments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id = vice_president_departments.organization_id
    )
  );

CREATE POLICY "Admins can update vice president departments"
  ON vice_president_departments
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id = vice_president_departments.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id = vice_president_departments.organization_id
    )
  );

CREATE POLICY "Admins can delete vice president departments"
  ON vice_president_departments
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
      AND profiles.organization_id = vice_president_departments.organization_id
    )
  );

CREATE POLICY "Vice presidents can view their departments"
  ON vice_president_departments
  FOR SELECT
  TO authenticated
  USING (vice_president_id = auth.uid());

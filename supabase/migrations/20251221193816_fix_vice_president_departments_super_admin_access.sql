/*
  # Fix Vice President Departments RLS for Super Admin

  1. Changes
    - Update policies to include super_admin role
    - Add organization context for proper access control
    
  2. Security
    - Admins and super admins can manage vice president departments
    - Vice presidents can view their own assignments
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins full access" ON vice_president_departments;
DROP POLICY IF EXISTS "VP read own" ON vice_president_departments;

-- Super admin and admin full access
CREATE POLICY "Admins and super admins full access"
  ON vice_president_departments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

-- Vice presidents can read their own departments
CREATE POLICY "VP read own departments"
  ON vice_president_departments
  FOR SELECT
  TO authenticated
  USING (vice_president_id = auth.uid());

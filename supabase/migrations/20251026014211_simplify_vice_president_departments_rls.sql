/*
  # Simplify Vice President Departments RLS

  1. Changes
    - Drop ALL existing policies
    - Create simple, working policies for admins
    - No complex checks, just basic role check
    
  2. Security
    - Only admins can manage vice_president_departments
    - Vice presidents can view their own assignments
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Admins can view vice president departments" ON vice_president_departments;
DROP POLICY IF EXISTS "Admins can insert vice president departments" ON vice_president_departments;
DROP POLICY IF EXISTS "Admins can update vice president departments" ON vice_president_departments;
DROP POLICY IF EXISTS "Admins can delete vice president departments" ON vice_president_departments;
DROP POLICY IF EXISTS "Vice presidents can view their departments" ON vice_president_departments;

-- Simple admin policies - just check if user is admin
CREATE POLICY "Admins full access"
  ON vice_president_departments
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- Vice presidents can only read their own
CREATE POLICY "VP read own"
  ON vice_president_departments
  FOR SELECT
  TO authenticated
  USING (vice_president_id = auth.uid());

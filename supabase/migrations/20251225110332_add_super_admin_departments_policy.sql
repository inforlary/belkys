/*
  # Add Super Admin Policy for Departments
  
  1. Changes
    - Add policy for super admins to view all departments
    
  2. Security
    - Only super admins can view all departments
    - Regular users maintain existing access
*/

-- Add super admin select policy for departments
CREATE POLICY "Super admins can view all departments"
  ON departments
  FOR SELECT
  TO authenticated
  USING (is_super_admin());

/*
  # Fix IC General Conditions RLS Insert Policy

  1. Problem
    - Admins and Directors cannot insert general conditions
    - Missing WITH CHECK clause for INSERT operations
    - Super admin policy needs WITH CHECK clause

  2. Solution
    - Drop existing policies
    - Recreate with proper WITH CHECK clauses for INSERT operations
    - Ensure admins/directors can insert conditions for their organization
    - Ensure super admins can insert any condition

  3. Security
    - Super admins: Full access to all conditions (including insert)
    - Admins/Directors: Can manage conditions in their own organization
    - All users: Can view global conditions and their organization's conditions
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Super admins have full access to general conditions" ON ic_general_conditions;
DROP POLICY IF EXISTS "Users can view general conditions in their organization" ON ic_general_conditions;
DROP POLICY IF EXISTS "Admins can manage general conditions in their organization" ON ic_general_conditions;

-- Super admins have full access (with WITH CHECK for inserts)
CREATE POLICY "Super admins have full access to general conditions"
  ON ic_general_conditions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- All users can view global conditions and their organization's conditions
CREATE POLICY "Users can view general conditions"
  ON ic_general_conditions
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_general_conditions.organization_id
    )
  );

-- Admins and Directors can manage conditions in their organization
CREATE POLICY "Admins can insert general conditions"
  ON ic_general_conditions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_general_conditions.organization_id
      AND profiles.role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins can update general conditions"
  ON ic_general_conditions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_general_conditions.organization_id
      AND profiles.role IN ('admin', 'director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_general_conditions.organization_id
      AND profiles.role IN ('admin', 'director')
    )
  );

CREATE POLICY "Admins can delete general conditions"
  ON ic_general_conditions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_general_conditions.organization_id
      AND profiles.role IN ('admin', 'director')
    )
  );

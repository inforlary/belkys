/*
  # Fix RLS Policy for IC General Conditions INSERT

  1. Problem
    - Users with ADMIN/DIRECTOR roles cannot insert general conditions
    - Current policy missing proper WITH CHECK clause for INSERT

  2. Solution
    - Drop and recreate the admin management policy
    - Add explicit INSERT policy with proper WITH CHECK
    - Ensure organization_id matches user's organization
*/

-- Drop existing admin management policy
DROP POLICY IF EXISTS "Admins can manage general conditions in their organization" ON ic_general_conditions;

-- Create separate policies for better control
CREATE POLICY "Admins can view general conditions in their organization"
  ON ic_general_conditions
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_general_conditions.organization_id
      AND profiles.role IN ('ADMIN', 'DIRECTOR', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Admins can insert general conditions in their organization"
  ON ic_general_conditions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_general_conditions.organization_id
      AND profiles.role IN ('ADMIN', 'DIRECTOR', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Admins can update general conditions in their organization"
  ON ic_general_conditions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_general_conditions.organization_id
      AND profiles.role IN ('ADMIN', 'DIRECTOR', 'SUPER_ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_general_conditions.organization_id
      AND profiles.role IN ('ADMIN', 'DIRECTOR', 'SUPER_ADMIN')
    )
  );

CREATE POLICY "Admins can delete general conditions in their organization"
  ON ic_general_conditions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_general_conditions.organization_id
      AND profiles.role IN ('ADMIN', 'DIRECTOR', 'SUPER_ADMIN')
    )
  );
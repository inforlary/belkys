/*
  # Fix IC General Conditions RLS - Complete Fix

  1. Problem
    - Super admin policy has FOR ALL but missing WITH CHECK
    - Multiple overlapping policies causing conflicts
    - INSERT operations failing for all users

  2. Solution
    - Drop all existing policies
    - Create clean, non-overlapping policies
    - Super admin gets explicit policies with WITH CHECK
    - Other roles get specific policies
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Super admins have full access to general conditions" ON ic_general_conditions;
DROP POLICY IF EXISTS "Users can view general conditions in their organization" ON ic_general_conditions;
DROP POLICY IF EXISTS "Admins can view general conditions in their organization" ON ic_general_conditions;
DROP POLICY IF EXISTS "Admins can insert general conditions in their organization" ON ic_general_conditions;
DROP POLICY IF EXISTS "Admins can update general conditions in their organization" ON ic_general_conditions;
DROP POLICY IF EXISTS "Admins can delete general conditions in their organization" ON ic_general_conditions;

-- Super Admin policies - Full access
CREATE POLICY "Super admins can view all general conditions"
  ON ic_general_conditions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Super admins can insert general conditions"
  ON ic_general_conditions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Super admins can update general conditions"
  ON ic_general_conditions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPER_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPER_ADMIN'
    )
  );

CREATE POLICY "Super admins can delete general conditions"
  ON ic_general_conditions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'SUPER_ADMIN'
    )
  );

-- Regular users can view global and their organization's conditions
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

-- Admins and Directors can manage their organization's conditions
CREATE POLICY "Admins can insert general conditions"
  ON ic_general_conditions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_general_conditions.organization_id
      AND profiles.role IN ('ADMIN', 'DIRECTOR')
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
      AND profiles.role IN ('ADMIN', 'DIRECTOR')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = ic_general_conditions.organization_id
      AND profiles.role IN ('ADMIN', 'DIRECTOR')
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
      AND profiles.role IN ('ADMIN', 'DIRECTOR')
    )
  );
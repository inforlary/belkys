/*
  # Fix risk_indicators RLS policies

  1. Changes
    - Drop duplicate and conflicting policies
    - Create clean, simple policies using organization_id

  2. Security
    - Admins (admin, director, super_admin) can manage all indicators
    - All users can view indicators in their organization
*/

-- Drop all existing policies
DROP POLICY IF EXISTS "Users can view risk indicators" ON risk_indicators;
DROP POLICY IF EXISTS "Admins can manage risk indicators" ON risk_indicators;
DROP POLICY IF EXISTS "Admins can insert risk indicators" ON risk_indicators;
DROP POLICY IF EXISTS "Admins can update risk indicators" ON risk_indicators;
DROP POLICY IF EXISTS "Admins can delete risk indicators" ON risk_indicators;
DROP POLICY IF EXISTS "Users can view risk indicators in their organization" ON risk_indicators;
DROP POLICY IF EXISTS "Users can create risk indicators in their organization" ON risk_indicators;
DROP POLICY IF EXISTS "Users can update risk indicators in their organization" ON risk_indicators;
DROP POLICY IF EXISTS "Users can delete risk indicators in their organization" ON risk_indicators;

-- Create clean policies
CREATE POLICY "Users can view risk indicators"
  ON risk_indicators FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert risk indicators"
  ON risk_indicators FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
    )
  );

CREATE POLICY "Admins can update risk indicators"
  ON risk_indicators FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
    )
  );

CREATE POLICY "Admins can delete risk indicators"
  ON risk_indicators FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
    )
  );
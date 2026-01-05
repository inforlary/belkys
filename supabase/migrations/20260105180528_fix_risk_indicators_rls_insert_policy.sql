/*
  # Fix Risk Indicators RLS Policies

  1. Changes
    - Drop existing ALL policy that doesn't have WITH CHECK
    - Create separate policies for INSERT, UPDATE, DELETE with proper USING and WITH CHECK clauses
    - Ensure proper access control for all operations

  2. Security
    - INSERT: Directors, Admins, and Super Admins can insert in their org
    - UPDATE/DELETE: Only for risks owned by user's department (directors) or org-level access (admins)
    - SELECT: All users can view indicators for risks in their organization
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Directors can manage risk indicators" ON risk_indicators;
DROP POLICY IF EXISTS "Users can view risk indicators" ON risk_indicators;

-- SELECT policy: Users can view indicators for risks in their organization
CREATE POLICY "Users can view risk indicators"
  ON risk_indicators FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM risks
      WHERE risks.id = risk_indicators.risk_id
        AND risks.organization_id IN (
          SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
    )
  );

-- INSERT policy: Directors and admins can insert indicators for risks they manage
CREATE POLICY "Directors and admins can insert risk indicators"
  ON risk_indicators FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM risks
      WHERE risks.id = risk_indicators.risk_id
        AND (
          -- Super admin can insert anywhere
          EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
          )
          -- Admin can insert in their organization
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
              AND profiles.organization_id = risks.organization_id
          )
          -- Director can insert for risks owned by their department
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'director'
              AND profiles.department_id = risks.owner_unit_id
              AND profiles.organization_id = risks.organization_id
          )
        )
    )
  );

-- UPDATE policy: Directors and admins can update indicators for risks they manage
CREATE POLICY "Directors and admins can update risk indicators"
  ON risk_indicators FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM risks
      WHERE risks.id = risk_indicators.risk_id
        AND (
          EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
          )
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'admin'
              AND profiles.organization_id = risks.organization_id
          )
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role = 'director'
              AND profiles.department_id = risks.owner_unit_id
              AND profiles.organization_id = risks.organization_id
          )
        )
    )
  );

-- DELETE policy: Only admins and super admins can deactivate indicators
CREATE POLICY "Admins can deactivate risk indicators"
  ON risk_indicators FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM risks
      WHERE risks.id = risk_indicators.risk_id
        AND (
          EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true
          )
          OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('admin', 'vice_president')
              AND profiles.organization_id = risks.organization_id
          )
        )
    )
  );

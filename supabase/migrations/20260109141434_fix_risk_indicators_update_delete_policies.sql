/*
  # Fix Risk Indicators Update and Delete Policies
  
  1. Changes
    - Drop the existing ALL policy which only has USING
    - Create separate UPDATE and DELETE policies with proper USING and WITH CHECK
    - Ensure admins can update and delete indicators they have access to
*/

-- Drop existing ALL policy
DROP POLICY IF EXISTS "Admins can manage risk indicators" ON risk_indicators;

-- Create separate UPDATE policy
CREATE POLICY "Admins can update risk indicators"
  ON risk_indicators
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM risks r
      INNER JOIN profiles p ON p.organization_id = r.organization_id
      WHERE r.id = risk_indicators.risk_id
        AND p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM risks r
      INNER JOIN profiles p ON p.organization_id = r.organization_id
      WHERE r.id = risk_indicators.risk_id
        AND p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'director')
    )
  );

-- Create separate DELETE policy
CREATE POLICY "Admins can delete risk indicators"
  ON risk_indicators
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM risks r
      INNER JOIN profiles p ON p.organization_id = r.organization_id
      WHERE r.id = risk_indicators.risk_id
        AND p.id = auth.uid()
        AND p.role IN ('super_admin', 'admin', 'director')
    )
  );

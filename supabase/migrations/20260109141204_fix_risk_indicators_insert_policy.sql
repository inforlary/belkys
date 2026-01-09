/*
  # Fix Risk Indicators Insert Policy
  
  1. Changes
    - Drop existing complex insert policy
    - Create simpler insert policy that checks organization_id through risks table
    - Ensure admins, directors, and super_admins can insert indicators
*/

-- Drop existing insert policy
DROP POLICY IF EXISTS "Admins can insert risk indicators" ON risk_indicators;

-- Create new simpler insert policy
CREATE POLICY "Admins can insert risk indicators"
  ON risk_indicators
  FOR INSERT
  TO authenticated
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

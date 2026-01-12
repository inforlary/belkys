/*
  # Add SELECT policy for risk_treatments table

  1. Changes
    - Add SELECT policy for risk_treatments table
    - Allow users to view risk treatments for risks in their organization

  2. Security
    - Users can only view treatments for risks in their organization
    - Super admins can view all treatments
*/

-- Add SELECT policy for risk_treatments
CREATE POLICY "Users can view risk treatments in their organization"
  ON risk_treatments FOR SELECT
  TO authenticated
  USING (
    -- Super admins can see all
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
    OR
    -- Regular users can see treatments for risks in their organization
    risk_id IN (
      SELECT id FROM risks WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
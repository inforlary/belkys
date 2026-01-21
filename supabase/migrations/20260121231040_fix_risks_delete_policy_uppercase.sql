/*
  # Fix Risks DELETE Policy for Uppercase Roles

  1. Changes
    - Update the DELETE capability in "Admins and directors can manage risks" policy
    - Ensure role checking uses uppercase: ADMIN, DIRECTOR
    - This fixes the issue where admins/directors cannot delete risks
*/

-- Drop and recreate the policy to ensure DELETE works
DROP POLICY IF EXISTS "Admins and directors can manage risks" ON risks;

-- Recreate with proper DELETE support
CREATE POLICY "Admins and directors can manage risks"
  ON risks FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('ADMIN', 'DIRECTOR')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('ADMIN', 'DIRECTOR')
    )
  );

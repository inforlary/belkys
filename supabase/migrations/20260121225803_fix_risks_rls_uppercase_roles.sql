/*
  # Fix Risks RLS Policy for Uppercase Roles

  1. Changes
    - Drop existing "Admins and directors can manage risks" policy
    - Recreate policy with uppercase role checking (ADMIN, DIRECTOR)
    - This fixes the issue where directors and admins cannot update/approve risks
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Admins and directors can manage risks" ON risks;

-- Recreate the policy with uppercase roles
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

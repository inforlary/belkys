/*
  # Fix Risks RLS for Lowercase Roles

  1. Issue
    - Database has lowercase roles: admin, director, user, vice_president
    - RLS policies check for uppercase: ADMIN, DIRECTOR
    - This prevents deletion and management operations

  2. Changes
    - Update all risks RLS policies to use lowercase role names
    - This fixes the delete issue and all management operations
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admins and directors can manage risks" ON risks;
DROP POLICY IF EXISTS "Super admins have full access to risks" ON risks;
DROP POLICY IF EXISTS "Users can create risks in their organization" ON risks;
DROP POLICY IF EXISTS "Users can view their organization risks" ON risks;

-- Recreate with lowercase roles
CREATE POLICY "Admins and directors can manage risks"
  ON risks FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'director')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid() AND role IN ('admin', 'director')
    )
  );

CREATE POLICY "Super admins have full access to risks"
  ON risks FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Users can create risks in their organization"
  ON risks FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view their organization risks"
  ON risks FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles 
      WHERE id = auth.uid()
    )
  );

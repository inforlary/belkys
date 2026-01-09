/*
  # Fix risk_treatments RLS policies for INSERT operations

  1. Changes
    - Drop existing "Admins can manage risk treatments" policy
    - Create separate policies for INSERT, UPDATE, DELETE operations
    - Allow all authenticated users to insert risk treatments for risks in their organization
    - Add WITH CHECK clause for INSERT operations

  2. Security
    - Users can only create treatments for risks in their organization
    - Admins/Directors/Super Admins can manage (update/delete) treatments
*/

-- Drop the existing policy that doesn't work for INSERT
DROP POLICY IF EXISTS "Admins can manage risk treatments" ON risk_treatments;

-- Allow authenticated users to insert risk treatments for risks in their organization
CREATE POLICY "Users can insert risk treatments"
  ON risk_treatments FOR INSERT
  TO authenticated
  WITH CHECK (
    risk_id IN (
      SELECT id FROM risks WHERE organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Allow admins to update risk treatments
CREATE POLICY "Admins can update risk treatments"
  ON risk_treatments FOR UPDATE
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
      )
    )
  )
  WITH CHECK (
    risk_id IN (
      SELECT id FROM risks WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
      )
    )
  );

-- Allow admins to delete risk treatments
CREATE POLICY "Admins can delete risk treatments"
  ON risk_treatments FOR DELETE
  TO authenticated
  USING (
    risk_id IN (
      SELECT id FROM risks WHERE organization_id IN (
        SELECT organization_id FROM profiles 
        WHERE id = auth.uid() AND role IN ('super_admin', 'admin', 'director')
      )
    )
  );

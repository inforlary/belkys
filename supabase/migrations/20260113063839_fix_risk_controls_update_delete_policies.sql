/*
  # Fix Risk Controls Update and Delete Policies for All Users

  1. Changes
    - Drop the ALL policy that only allows admins/directors
    - Create separate UPDATE and DELETE policies for all authenticated users
  
  2. Security
    - Users can update/delete controls for risks in their own organization
    - Maintains organization-level data isolation
*/

DROP POLICY IF EXISTS "Admins can manage risk controls" ON risk_controls;

CREATE POLICY "Users can update risk controls in their organization"
  ON risk_controls
  FOR UPDATE
  TO authenticated
  USING (
    risk_id IN (
      SELECT r.id
      FROM risks r
      JOIN profiles p ON p.organization_id = r.organization_id
      WHERE p.id = auth.uid()
    )
  )
  WITH CHECK (
    risk_id IN (
      SELECT r.id
      FROM risks r
      JOIN profiles p ON p.organization_id = r.organization_id
      WHERE p.id = auth.uid()
    )
  );

CREATE POLICY "Users can delete risk controls in their organization"
  ON risk_controls
  FOR DELETE
  TO authenticated
  USING (
    risk_id IN (
      SELECT r.id
      FROM risks r
      JOIN profiles p ON p.organization_id = r.organization_id
      WHERE p.id = auth.uid()
    )
  );

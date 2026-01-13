/*
  # Fix Risk Controls Insert Policy for All Users

  1. Changes
    - Drop the restrictive insert policy that only allows admins/directors
    - Create a new insert policy that allows all authenticated users to add controls to risks in their organization
  
  2. Security
    - Users can only insert controls for risks in their own organization
    - Maintains organization-level data isolation
*/

DROP POLICY IF EXISTS "Admins can insert risk controls" ON risk_controls;

CREATE POLICY "Users can insert risk controls in their organization"
  ON risk_controls
  FOR INSERT
  TO authenticated
  WITH CHECK (
    risk_id IN (
      SELECT r.id
      FROM risks r
      JOIN profiles p ON p.organization_id = r.organization_id
      WHERE p.id = auth.uid()
    )
  );

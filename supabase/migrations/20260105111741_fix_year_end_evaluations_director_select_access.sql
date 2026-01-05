/*
  # Fix Year End Evaluations Director SELECT Access

  1. Changes
    - Add SELECT policy for directors to view their department's year-end evaluations
    - Directors should be able to view evaluations for their own department
  
  2. Security
    - Directors can only view evaluations for their own department
    - Maintains existing security boundaries
*/

-- Add SELECT policy for directors
CREATE POLICY "Directors can view their department year_end_evaluations"
  ON year_end_evaluations
  FOR SELECT
  TO authenticated
  USING (
    department_id IN (
      SELECT department_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
    AND organization_id IN (
      SELECT organization_id 
      FROM profiles 
      WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
      AND role = 'director'
    )
  );

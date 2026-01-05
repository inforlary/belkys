/*
  # Fix Director Submit Own Evaluation

  1. Changes
    - Add policy for directors to submit their own department's draft evaluations
    - Directors should be able to change status from 'draft' to 'submitted'
  
  2. Security
    - Only applies to director's own department
    - Only allows draft -> submitted transition
*/

-- Add policy for directors to submit their own evaluations
CREATE POLICY "Directors can submit their own draft year_end_evaluations"
  ON year_end_evaluations
  FOR UPDATE
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
    AND status = 'draft'
  )
  WITH CHECK (
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
    AND status = 'submitted'
  );

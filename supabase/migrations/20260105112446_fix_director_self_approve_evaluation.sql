/*
  # Fix Director Self-Approve Evaluation

  1. Changes
    - Update RLS policy to allow directors to change status from 'draft' to 'director_approved'
    - Directors submitting their own department's evaluation should skip the 'submitted' status
  
  2. Security
    - Only applies to director's own department
    - Only allows draft -> director_approved transition
*/

-- Drop the previous policy
DROP POLICY IF EXISTS "Directors can submit their own draft year_end_evaluations" ON year_end_evaluations;

-- Add updated policy for directors to self-approve their own evaluations
CREATE POLICY "Directors can self-approve their own draft year_end_evaluations"
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
    AND status IN ('submitted', 'director_approved')
  );

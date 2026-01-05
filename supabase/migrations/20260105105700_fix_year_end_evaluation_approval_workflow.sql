/*
  # Fix Year-End Evaluation Approval Workflow

  1. Changes
    - Updates approval workflow to 3-stage process: user -> director -> admin/VP
    - Fixes RLS policies for proper approval permissions
    - Removes admin_approved intermediate status from workflow
    - Ensures directors can only approve their department's evaluations
    - Ensures admins/VPs can approve all evaluations in their organization

  2. Workflow
    - draft: User creates and edits
    - submitted: User submits for approval
    - director_approved: Director approves (waiting for admin approval)
    - completed: Admin/VP gives final approval

  3. Security
    - Directors can approve only their department's submitted evaluations
    - Admins/VPs can approve director_approved evaluations to completed
    - Users can only edit draft evaluations
*/

DROP POLICY IF EXISTS "Directors can approve year_end_evaluations" ON year_end_evaluations;
DROP POLICY IF EXISTS "Admins can approve year_end_evaluations" ON year_end_evaluations;

CREATE POLICY "Directors can approve their department year_end_evaluations"
  ON year_end_evaluations FOR UPDATE
  TO authenticated
  USING (
    department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'director'
    )
    AND status = 'submitted'
  )
  WITH CHECK (
    department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
    AND status = 'director_approved'
  );

CREATE POLICY "Admins and VPs can give final approval to year_end_evaluations"
  ON year_end_evaluations FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'vice_president')
    )
    AND status = 'director_approved'
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND status = 'completed'
  );

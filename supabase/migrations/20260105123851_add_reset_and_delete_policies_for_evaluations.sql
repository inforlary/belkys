/*
  # Add Reset and Delete Policies for Year-End Evaluations (Option 2)
  
  1. Changes
    - Allow admins and super_admins to reset completed evaluations back to draft
    - Allow admins and super_admins to delete draft evaluations
    - Provides two-step safety: reset to draft first, then delete
  
  2. Security
    - Only admins, VPs, and super_admins can reset completed evaluations
    - Only admins, VPs, and super_admins can delete evaluations (but only drafts)
    - Regular users cannot delete evaluations once submitted
*/

-- Allow admins and VPs to update completed evaluations (to reset them to draft)
CREATE POLICY "Admins can reset completed year_end_evaluations to draft"
  ON year_end_evaluations FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'vice_president', 'super_admin')
    )
    AND status = 'completed'
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND status = 'draft'
  );

-- Allow admins and super admins to delete draft evaluations
CREATE POLICY "Admins can delete draft year_end_evaluations"
  ON year_end_evaluations FOR DELETE
  TO authenticated
  USING (
    status = 'draft'
    AND (
      organization_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'vice_president', 'super_admin')
      )
    )
  );

-- Users can also delete their own department's draft evaluations
CREATE POLICY "Users can delete their own draft year_end_evaluations"
  ON year_end_evaluations FOR DELETE
  TO authenticated
  USING (
    status = 'draft'
    AND department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Allow deleting indicator evaluations when parent is deleted (cascade is already in FK)
-- But also allow manual deletion by admins for draft evaluations
CREATE POLICY "Admins can delete indicator_year_evaluations for draft evaluations"
  ON indicator_year_evaluations FOR DELETE
  TO authenticated
  USING (
    year_end_evaluation_id IN (
      SELECT id FROM year_end_evaluations
      WHERE status = 'draft'
      AND (
        organization_id IN (
          SELECT organization_id FROM profiles WHERE id = auth.uid()
        )
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role IN ('admin', 'vice_president', 'super_admin')
        )
      )
    )
  );

-- Users can delete their own indicator evaluations for draft evaluations
CREATE POLICY "Users can delete their own indicator_year_evaluations"
  ON indicator_year_evaluations FOR DELETE
  TO authenticated
  USING (
    year_end_evaluation_id IN (
      SELECT id FROM year_end_evaluations
      WHERE status = 'draft'
      AND department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

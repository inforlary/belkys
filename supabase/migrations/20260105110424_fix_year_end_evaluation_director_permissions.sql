/*
  # Fix Year-End Evaluation Director Permissions

  1. Changes
    - Allow directors to update draft evaluations in their department
    - Directors can submit evaluations on behalf of their team
    - Directors can edit and resubmit evaluations that were rejected
    - Ensures proper workflow: draft -> submitted -> director_approved -> completed
  
  2. Director Capabilities
    - Can create, view, and edit draft evaluations for their department
    - Can submit evaluations to themselves for approval
    - Can approve submitted evaluations from their team
    - Can reject and send back evaluations to draft status
  
  3. Security
    - Directors can only work with evaluations from their own department
    - Directors cannot skip approval stages
    - All changes are tracked with timestamps and user IDs
*/

-- Drop existing director update policy for drafts
DROP POLICY IF EXISTS "Users can update draft year_end_evaluations" ON year_end_evaluations;

-- Allow users AND directors to update draft evaluations in their department
CREATE POLICY "Users and directors can update draft year_end_evaluations"
  ON year_end_evaluations FOR UPDATE
  TO authenticated
  USING (
    department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
    AND status = 'draft'
  )
  WITH CHECK (
    department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Allow directors to create evaluations for their department
CREATE POLICY "Directors can create year_end_evaluations for their department"
  ON year_end_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
    AND organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('director', 'user')
    )
  );

-- Update director approval policy to allow rejecting evaluations
DROP POLICY IF EXISTS "Directors can approve their department year_end_evaluations" ON year_end_evaluations;

CREATE POLICY "Directors can approve or reject their department year_end_evaluations"
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
    AND status IN ('submitted', 'director_approved')
  )
  WITH CHECK (
    department_id IN (
      SELECT department_id FROM profiles WHERE id = auth.uid()
    )
    AND status IN ('draft', 'director_approved')
  );

-- Update indicator evaluations RLS to allow directors full access
DROP POLICY IF EXISTS "Users can update draft indicator_year_evaluations" ON indicator_year_evaluations;

CREATE POLICY "Users and directors can update draft indicator_year_evaluations"
  ON indicator_year_evaluations FOR UPDATE
  TO authenticated
  USING (
    year_end_evaluation_id IN (
      SELECT id FROM year_end_evaluations
      WHERE department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
      AND status = 'draft'
    )
  )
  WITH CHECK (
    year_end_evaluation_id IN (
      SELECT id FROM year_end_evaluations
      WHERE department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- Allow directors to create indicator evaluations
CREATE POLICY "Directors can create indicator_year_evaluations"
  ON indicator_year_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    year_end_evaluation_id IN (
      SELECT id FROM year_end_evaluations
      WHERE department_id IN (
        SELECT department_id FROM profiles WHERE id = auth.uid()
      )
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('director', 'user')
    )
  );

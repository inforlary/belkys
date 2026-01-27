/*
  # Fix BPM Categories RLS Policies

  1. Problem
    - Current policy uses FOR ALL which doesn't provide WITH CHECK for INSERT
    - Causes silent failures on insert operations

  2. Solution
    - Drop existing policy
    - Create separate policies for INSERT, UPDATE, DELETE with proper WITH CHECK
*/

-- Drop existing combined policy
DROP POLICY IF EXISTS "admins_manage_bpm_categories" ON bpm_categories;

-- Create separate policies with proper WITH CHECK
CREATE POLICY "admins_insert_bpm_categories" ON bpm_categories
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = bpm_categories.organization_id
      AND profiles.role IN ('admin', 'director')
    )
  );

CREATE POLICY "admins_update_bpm_categories" ON bpm_categories
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = bpm_categories.organization_id
      AND profiles.role IN ('admin', 'director')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = bpm_categories.organization_id
      AND profiles.role IN ('admin', 'director')
    )
  );

CREATE POLICY "admins_delete_bpm_categories" ON bpm_categories
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = bpm_categories.organization_id
      AND profiles.role IN ('admin', 'director')
    )
  );

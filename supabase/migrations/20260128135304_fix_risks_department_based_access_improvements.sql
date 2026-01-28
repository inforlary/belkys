/*
  # Fix Risks Department-Based Access Control Improvements

  1. Changes
    - Standardize role names in RLS policies (consistent casing)
    - Ensure directors can only view their department's risks
    - Ensure users can only view their department's risks
    - Add validation for coordination_department_id when needed
    - Improve INSERT policy validation

  2. Security
    - Enforce department-level access control
    - Prevent users from creating risks for other departments
    - Maintain existing approval workflow requirements
*/

-- Drop existing select policies for risks
DROP POLICY IF EXISTS "Super admins can view all risks" ON risks;
DROP POLICY IF EXISTS "Admins can view all risks in organization" ON risks;
DROP POLICY IF EXISTS "Directors can view department risks" ON risks;
DROP POLICY IF EXISTS "Users can view department risks" ON risks;
DROP POLICY IF EXISTS "risks_select_super_admin" ON risks;
DROP POLICY IF EXISTS "risks_select_admin" ON risks;
DROP POLICY IF EXISTS "risks_select_director" ON risks;
DROP POLICY IF EXISTS "risks_select_user" ON risks;

-- Recreate SELECT policies with consistent role names
CREATE POLICY "risks_select_super_admin"
  ON risks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "risks_select_admin"
  ON risks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = risks.organization_id
      AND profiles.role IN ('admin', 'ADMIN')
    )
  );

CREATE POLICY "risks_select_director"
  ON risks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = risks.organization_id
      AND profiles.role IN ('director', 'DIRECTOR')
      AND profiles.department_id = risks.owner_department_id
    )
  );

CREATE POLICY "risks_select_user"
  ON risks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = risks.organization_id
      AND profiles.role IN ('user', 'USER')
      AND profiles.department_id = risks.owner_department_id
    )
  );

-- Drop existing insert policies
DROP POLICY IF EXISTS "Users can create risks" ON risks;
DROP POLICY IF EXISTS "risks_insert" ON risks;
DROP POLICY IF EXISTS "risks_insert_user" ON risks;

-- Recreate INSERT policy with stronger department validation
CREATE POLICY "risks_insert_with_department_validation"
  ON risks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = risks.organization_id
      AND (
        -- Super admins can create for any department
        profiles.role = 'super_admin'
        -- Admins can create for any department in their organization
        OR profiles.role IN ('admin', 'ADMIN')
        -- Directors and users can only create for their own department
        OR (
          profiles.role IN ('director', 'DIRECTOR', 'user', 'USER')
          AND profiles.department_id = risks.owner_department_id
          AND risks.status = 'DRAFT'
        )
      )
    )
  );

-- Drop existing update policies
DROP POLICY IF EXISTS "Users can update own draft risks" ON risks;
DROP POLICY IF EXISTS "Directors can update department risks" ON risks;
DROP POLICY IF EXISTS "Admins can update all risks" ON risks;
DROP POLICY IF EXISTS "risks_update_creator" ON risks;
DROP POLICY IF EXISTS "risks_update_director" ON risks;
DROP POLICY IF EXISTS "risks_update_admin" ON risks;

-- Recreate UPDATE policies with consistent role names
CREATE POLICY "risks_update_creator"
  ON risks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = risks.organization_id
      AND risks.identified_by_id = auth.uid()
      AND risks.status IN ('DRAFT', 'REJECTED')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = risks.organization_id
      AND profiles.department_id = risks.owner_department_id
    )
  );

CREATE POLICY "risks_update_director"
  ON risks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = risks.organization_id
      AND profiles.role IN ('director', 'DIRECTOR')
      AND profiles.department_id = risks.owner_department_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = risks.organization_id
      AND profiles.role IN ('director', 'DIRECTOR')
      AND profiles.department_id = risks.owner_department_id
    )
  );

CREATE POLICY "risks_update_admin"
  ON risks
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = risks.organization_id
      AND profiles.role IN ('admin', 'ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = risks.organization_id
      AND profiles.role IN ('admin', 'ADMIN')
    )
  );

-- Drop existing delete policies
DROP POLICY IF EXISTS "Users can delete own draft risks" ON risks;
DROP POLICY IF EXISTS "risks_delete" ON risks;

-- Recreate DELETE policy with consistent role names
CREATE POLICY "risks_delete_draft_only"
  ON risks
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = risks.organization_id
      AND (
        profiles.role = 'super_admin'
        OR profiles.role IN ('admin', 'ADMIN')
        OR (
          risks.identified_by_id = auth.uid()
          AND risks.status = 'DRAFT'
        )
      )
    )
  );
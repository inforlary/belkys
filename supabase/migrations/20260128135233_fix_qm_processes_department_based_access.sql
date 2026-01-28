/*
  # Fix QM Processes Department-Based Access Control

  1. Changes
    - Update qm_processes SELECT RLS policy to enforce department-based filtering
    - Directors can only see their department's processes
    - Users can only see their department's APPROVED processes
    - Admins and super admins can see all processes
    - Update INSERT policy to allow users to create processes
    - Add validation to ensure users can only create processes for their own department

  2. Security
    - Enforce department-level access control
    - Prevent users from creating processes for other departments
    - Maintain existing approval workflow requirements
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view qm_processes" ON qm_processes;
DROP POLICY IF EXISTS "Users can create qm_processes" ON qm_processes;
DROP POLICY IF EXISTS "Users can update qm_processes" ON qm_processes;
DROP POLICY IF EXISTS "qm_processes_select" ON qm_processes;
DROP POLICY IF EXISTS "qm_processes_insert" ON qm_processes;
DROP POLICY IF EXISTS "qm_processes_update" ON qm_processes;

-- Recreate SELECT policy with department filtering
CREATE POLICY "qm_processes_select_department_based"
  ON qm_processes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = qm_processes.organization_id
      AND (
        -- Super admins see all
        profiles.role = 'super_admin'
        -- Admins see all in their organization
        OR profiles.role IN ('admin', 'ADMIN')
        -- Directors see only their department's processes
        OR (
          profiles.role IN ('director', 'DIRECTOR')
          AND profiles.department_id = qm_processes.owner_department_id
        )
        -- Users see only their department's APPROVED processes
        OR (
          profiles.role IN ('user', 'USER')
          AND profiles.department_id = qm_processes.owner_department_id
          AND qm_processes.status = 'APPROVED'
        )
      )
    )
  );

-- Recreate INSERT policy to allow users, directors, and admins with department validation
CREATE POLICY "qm_processes_insert_with_department_validation"
  ON qm_processes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = qm_processes.organization_id
      AND (
        -- Super admins can create for any department
        profiles.role = 'super_admin'
        -- Admins can create for any department in their organization
        OR profiles.role IN ('admin', 'ADMIN')
        -- Directors and users can only create for their own department
        OR (
          profiles.role IN ('director', 'DIRECTOR', 'user', 'USER')
          AND profiles.department_id = qm_processes.owner_department_id
        )
      )
    )
  );

-- Recreate UPDATE policy with department validation
CREATE POLICY "qm_processes_update_with_department_validation"
  ON qm_processes
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = qm_processes.organization_id
      AND (
        -- Super admins can update any
        profiles.role = 'super_admin'
        -- Admins can update any in their organization
        OR profiles.role IN ('admin', 'ADMIN')
        -- Directors can update their department's processes
        OR (
          profiles.role IN ('director', 'DIRECTOR')
          AND profiles.department_id = qm_processes.owner_department_id
        )
        -- Users can update their own department's processes (if they created them)
        OR (
          profiles.role IN ('user', 'USER')
          AND profiles.department_id = qm_processes.owner_department_id
          AND qm_processes.created_by = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = qm_processes.organization_id
      AND (
        profiles.role = 'super_admin'
        OR profiles.role IN ('admin', 'ADMIN')
        OR (
          profiles.role IN ('director', 'DIRECTOR', 'user', 'USER')
          AND profiles.department_id = qm_processes.owner_department_id
        )
      )
    )
  );

-- Keep existing DELETE policy (only admins and super admins)
DROP POLICY IF EXISTS "Users can delete qm_processes" ON qm_processes;
DROP POLICY IF EXISTS "qm_processes_delete" ON qm_processes;

CREATE POLICY "qm_processes_delete_admin_only"
  ON qm_processes
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.organization_id = qm_processes.organization_id
      AND profiles.role IN ('super_admin', 'admin', 'ADMIN')
    )
  );
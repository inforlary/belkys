/*
  # Fix Indicator Data Entries RLS Policies with Department Controls

  1. Changes
    - Drop and recreate RLS policies to include department_id checks
    - Directors can only update entries in their own department
    - Users can only update their own draft/rejected entries in their department
    - Admins can update all entries in their organization

  2. Security
    - Strengthened RLS policies with department-level access control
    - Prevents cross-department data manipulation
    - Status-based workflow enforcement
*/

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "admins_update_all_entries" ON indicator_data_entries;
DROP POLICY IF EXISTS "directors_update_entries" ON indicator_data_entries;
DROP POLICY IF EXISTS "users_update_own_draft_entries" ON indicator_data_entries;

-- Recreate UPDATE policies with proper department checks

-- Admins and super admins can update all entries in their organization
CREATE POLICY "admins_update_all_entries"
ON indicator_data_entries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.organization_id = indicator_data_entries.organization_id
      AND profiles.role IN ('admin', 'vice_president', 'super_admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.organization_id = indicator_data_entries.organization_id
      AND profiles.role IN ('admin', 'vice_president', 'super_admin')
  )
);

-- Directors can update entries in their department (for approval workflow)
CREATE POLICY "directors_update_entries"
ON indicator_data_entries
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.organization_id = indicator_data_entries.organization_id
      AND profiles.department_id = indicator_data_entries.department_id
      AND profiles.role = 'director'
  )
  AND status IN ('pending_director', 'pending_admin')
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.organization_id = indicator_data_entries.organization_id
      AND profiles.department_id = indicator_data_entries.department_id
      AND profiles.role = 'director'
  )
  AND status IN ('pending_director', 'pending_admin')
);

-- Users can update their own draft or rejected entries in their department
CREATE POLICY "users_update_own_draft_entries"
ON indicator_data_entries
FOR UPDATE
TO authenticated
USING (
  entered_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.organization_id = indicator_data_entries.organization_id
      AND profiles.department_id = indicator_data_entries.department_id
  )
  AND status IN ('draft', 'rejected')
)
WITH CHECK (
  entered_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.organization_id = indicator_data_entries.organization_id
      AND profiles.department_id = indicator_data_entries.department_id
  )
  AND status IN ('draft', 'rejected', 'pending_director')
);
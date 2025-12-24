/*
  # Fix INSERT Policy for Directors and Admins

  1. Problem
    - Current INSERT policy is too restrictive for directors
    - Directors with valid department_id cannot insert entries
    - Policy requires department_id match but doesn't account for role differences

  2. Solution
    - Allow admins to insert entries for any department in their organization
    - Allow directors to insert entries only for their own department
    - Allow regular users to insert entries for their department
    - Ensure department_id is always set

  3. Security
    - Maintain organization boundaries
    - Enforce department-level restrictions for directors and users
    - Allow admins flexibility to manage all departments
*/

-- Drop existing INSERT policy
DROP POLICY IF EXISTS "insert_data_entries" ON indicator_data_entries;

-- Create new comprehensive INSERT policy
CREATE POLICY "insert_data_entries"
  ON indicator_data_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    entered_by = auth.uid()
    AND organization_id IS NOT NULL
    AND department_id IS NOT NULL
    AND (
      -- Admins and vice presidents can insert for any department in their organization
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.organization_id = indicator_data_entries.organization_id
          AND profiles.role IN ('admin', 'vice_president', 'super_admin')
      )
      OR
      -- Directors and regular users can only insert for their own department
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.organization_id = indicator_data_entries.organization_id
          AND profiles.department_id = indicator_data_entries.department_id
          AND profiles.role IN ('director', 'user')
      )
    )
  );

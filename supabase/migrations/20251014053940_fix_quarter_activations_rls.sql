/*
  # Fix quarter_activations RLS policies to avoid recursion

  1. Problem
    - Policies use SELECT on profiles table causing infinite recursion
    - Uses helper functions for safe queries

  2. Solution
    - Use existing is_admin() and current_user_org() functions
    - Simplify all policies

  3. Security
    - All authenticated users can view activations in their org
    - Only admins can create/update/delete activations
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view quarter activations for their org" ON quarter_activations;
DROP POLICY IF EXISTS "Admins can insert quarter activations" ON quarter_activations;
DROP POLICY IF EXISTS "Admins can update quarter activations" ON quarter_activations;
DROP POLICY IF EXISTS "Admins can delete quarter activations" ON quarter_activations;

-- Policy: All users can view activations in their organization
CREATE POLICY "select_activations"
  ON quarter_activations FOR SELECT
  TO authenticated
  USING (organization_id = current_user_org());

-- Policy: Admins can insert activations
CREATE POLICY "insert_activations"
  ON quarter_activations FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin() AND organization_id = current_user_org()
  );

-- Policy: Admins can update activations
CREATE POLICY "update_activations"
  ON quarter_activations FOR UPDATE
  TO authenticated
  USING (
    is_admin() AND organization_id = current_user_org()
  )
  WITH CHECK (
    is_admin() AND organization_id = current_user_org()
  );

-- Policy: Admins can delete activations
CREATE POLICY "delete_activations"
  ON quarter_activations FOR DELETE
  TO authenticated
  USING (
    is_admin() AND organization_id = current_user_org()
  );

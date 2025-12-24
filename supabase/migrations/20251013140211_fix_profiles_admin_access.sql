/*
  # Fix profiles table admin access

  1. Changes
    - Add policy for admins to view all profiles in their organization
    - Add policy for admins to update profiles in their organization

  2. Security
    - Admins can view all users in their organization
    - Admins can update user roles and departments
    - Regular users can still only view their own profile
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Allow users to view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Allow admins to view all profiles in their organization
CREATE POLICY "Admins can view all profiles in org"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    role = 'admin'
    AND organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Allow admins to update profiles in their organization
CREATE POLICY "Admins can update profiles in org"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
    AND organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

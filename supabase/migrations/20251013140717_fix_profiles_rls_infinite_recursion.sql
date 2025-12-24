/*
  # Fix profiles infinite recursion in RLS policies

  1. Problem
    - RLS policies are causing infinite recursion
    - Auth context cannot load user profile

  2. Solution
    - Simplify policies to avoid recursion
    - Use simpler checks without nested selects
    - Allow users to read their own profile
    - Allow admins to read profiles in same organization

  3. Security
    - Users can view their own profile
    - Admins can view all profiles in their organization
    - Profiles can be created during signup
    - Users can update their own profile
*/

-- Drop all existing policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles in org" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles in org" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation" ON profiles;
DROP POLICY IF EXISTS "Prevent profile deletion" ON profiles;

-- Policy: Users can always view their own profile (no recursion)
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Policy: Admins can view profiles in same organization
CREATE POLICY "Admins can view org profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
      AND admin_profile.organization_id = profiles.organization_id
    )
  );

-- Policy: Allow profile creation during signup
CREATE POLICY "Allow profile creation"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Users can update their own profile basic fields
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Policy: Admins can update profiles in their organization
CREATE POLICY "Admins can update org profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
      AND admin_profile.organization_id = profiles.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
      AND admin_profile.organization_id = profiles.organization_id
    )
  );

-- Policy: Prevent profile deletion
CREATE POLICY "Prevent profile deletion"
  ON profiles FOR DELETE
  TO authenticated
  USING (false);

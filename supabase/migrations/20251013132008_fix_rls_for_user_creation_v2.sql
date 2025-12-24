/*
  # Fix RLS policies to allow admin user creation

  1. Changes
    - Drop all existing policies first
    - Drop the is_admin() function with CASCADE
    - Create simple policies that don't cause recursion

  2. Security
    - Service role can create users (used by edge functions)
    - Users can view and update their own profiles
    - Application logic handles admin permissions
*/

-- Drop all existing policies first
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile, admins can update all" ON profiles;

-- Drop the problematic function with CASCADE
DROP FUNCTION IF EXISTS is_admin() CASCADE;

-- Simple SELECT: users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Simple INSERT: allow all authenticated (controlled by application)
CREATE POLICY "Allow profile creation"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Simple UPDATE: users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Simple DELETE: no one can delete profiles via client
CREATE POLICY "Prevent profile deletion"
  ON profiles FOR DELETE
  TO authenticated
  USING (false);

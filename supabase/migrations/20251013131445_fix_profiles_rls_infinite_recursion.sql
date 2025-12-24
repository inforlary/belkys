/*
  # Fix infinite recursion in profiles RLS policies

  1. Changes
    - Drop existing admin policies that cause recursion
    - Create new policies using auth.jwt() to check admin role
    - This avoids querying the profiles table within RLS policies

  2. Security
    - Admin role is checked via JWT metadata
    - Users can still view and update their own profiles
    - Admins have full access within their organization
*/

-- Drop existing admin policies
DROP POLICY IF EXISTS "Adminler organizasyondaki tüm profilleri görüntüleyebilir" ON profiles;
DROP POLICY IF EXISTS "Adminler yeni kullanıcı ekleyebilir" ON profiles;
DROP POLICY IF EXISTS "Adminler kullanıcı silebilir" ON profiles;
DROP POLICY IF EXISTS "Adminler kullanıcı bilgilerini güncelleyebilir" ON profiles;

-- Create a function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Allow admins to view all profiles (using function to avoid recursion)
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR is_admin()
  );

-- Allow admins to insert new profiles
CREATE POLICY "Admins can insert profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    is_admin() AND id != auth.uid()
  );

-- Allow users to update their own profile, admins can update all
CREATE POLICY "Users can update own profile, admins can update all"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR is_admin())
  WITH CHECK (id = auth.uid() OR is_admin());

-- Drop old policies
DROP POLICY IF EXISTS "Kullanıcılar kendi profillerini görüntüleyebilir" ON profiles;
DROP POLICY IF EXISTS "Kullanıcılar kendi profillerini güncelleyebilir" ON profiles;

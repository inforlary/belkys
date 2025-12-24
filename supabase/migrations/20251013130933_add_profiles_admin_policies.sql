/*
  # Add admin policies for profiles table

  1. Changes
    - Add INSERT policy for admin users to create new profiles
    - Add DELETE policy for admin users to remove profiles
    - Add SELECT policy for admins to view all profiles in their organization

  2. Security
    - Only authenticated users with 'admin' role can insert/delete profiles
    - Admins can only manage profiles within their organization
    - Users can still view and update their own profiles (existing policies)
*/

-- Allow admins to view all profiles in their organization
CREATE POLICY "Adminler organizasyondaki tüm profilleri görüntüleyebilir"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
      AND admin_profile.organization_id = profiles.organization_id
    )
  );

-- Allow admins to insert new profiles
CREATE POLICY "Adminler yeni kullanıcı ekleyebilir"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles AS admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
      AND admin_profile.organization_id = profiles.organization_id
    )
  );

-- Allow admins to delete profiles in their organization
CREATE POLICY "Adminler kullanıcı silebilir"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
      AND admin_profile.organization_id = profiles.organization_id
    )
    AND id != auth.uid()
  );

-- Allow admins to update other users' profiles in their organization
CREATE POLICY "Adminler kullanıcı bilgilerini güncelleyebilir"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
      AND admin_profile.organization_id = profiles.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles AS admin_profile
      WHERE admin_profile.id = auth.uid()
      AND admin_profile.role = 'admin'
      AND admin_profile.organization_id = profiles.organization_id
    )
  );

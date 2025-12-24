/*
  # Create simple RLS policies for profiles (no recursion)

  1. Strategy
    - Use SECURITY DEFINER functions to avoid recursion
    - Keep policies as simple as possible
    - No nested SELECT on profiles table

  2. Policies
    - Users can always read their own profile
    - Admins can read all profiles (check via function)
    - Users can update their own profile
    - Admins can update profiles (check via function)
    - Allow profile creation
    - Prevent deletion

  3. Security
    - No infinite recursion
    - Safe admin checks
    - Proper isolation
*/

-- Create a function to check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );
$$;

-- Create a function to get current user's organization
CREATE OR REPLACE FUNCTION current_user_org()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid();
$$;

-- Policy: Users can read their own profile
CREATE POLICY "select_own_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Policy: Admins can read all profiles in their org
CREATE POLICY "select_org_profiles_if_admin"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    is_admin() AND organization_id = current_user_org()
  );

-- Policy: Allow profile creation
CREATE POLICY "insert_profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policy: Users can update their own profile
CREATE POLICY "update_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy: Admins can update profiles in their org
CREATE POLICY "update_org_profiles_if_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    is_admin() AND organization_id = current_user_org()
  )
  WITH CHECK (
    is_admin() AND organization_id = current_user_org()
  );

-- Policy: Prevent deletion
CREATE POLICY "prevent_delete_profile"
  ON profiles FOR DELETE
  TO authenticated
  USING (false);

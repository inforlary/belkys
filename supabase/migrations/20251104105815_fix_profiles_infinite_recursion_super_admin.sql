/*
  # Fix Profiles Infinite Recursion Issue
  
  1. Changes
    - Replace recursive policy with security definer function
    - Use function to check super admin status without recursion
    
  2. Security
    - Maintains all existing access controls
    - Prevents infinite recursion in RLS policies
*/

-- Create security definer function to check super admin status
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM profiles WHERE id = auth.uid() LIMIT 1),
    false
  );
$$;

-- Create security definer function to get user's organization
CREATE OR REPLACE FUNCTION get_user_organization_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT organization_id FROM profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON profiles;
DROP POLICY IF EXISTS "Super admins can create profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can update profiles" ON profiles;

-- Recreate policies using security definer functions
CREATE POLICY "Users can view profiles in their organization"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Super admins can create profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Fix organizations policies too
DROP POLICY IF EXISTS "Users can view organizations" ON organizations;
DROP POLICY IF EXISTS "Super admins can create organizations" ON organizations;
DROP POLICY IF EXISTS "Super admins can update organizations" ON organizations;

CREATE POLICY "Users can view organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id = get_user_organization_id()
    OR is_super_admin()
  );

CREATE POLICY "Super admins can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());

-- Fix super_admin_activity_logs policies
DROP POLICY IF EXISTS "Super admins can view activity logs" ON super_admin_activity_logs;
DROP POLICY IF EXISTS "Super admins can insert activity logs" ON super_admin_activity_logs;

CREATE POLICY "Super admins can view activity logs"
  ON super_admin_activity_logs FOR SELECT
  TO authenticated
  USING (is_super_admin());

CREATE POLICY "Super admins can insert activity logs"
  ON super_admin_activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    is_super_admin()
    AND super_admin_id = auth.uid()
  );
/*
  # Create Super Admin and Multi-Tenant SaaS System

  1. New Tables
    - `organizations_management`
      - Extended organization info with subdomain, settings, status
      - Logo, contact info, subscription details
    
  2. Changes
    - Add `is_super_admin` field to profiles
    - Add subdomain column to organizations table
    
  3. Security
    - Super admin can access all organizations
    - Super admin can create new organizations
    - Regular users cannot see super admin features
*/

-- Add subdomain to organizations if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'subdomain'
  ) THEN
    ALTER TABLE organizations ADD COLUMN subdomain text UNIQUE;
  END IF;
END $$;

-- Add logo and contact info to organizations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE organizations ADD COLUMN logo_url text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'contact_email'
  ) THEN
    ALTER TABLE organizations ADD COLUMN contact_email text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'contact_phone'
  ) THEN
    ALTER TABLE organizations ADD COLUMN contact_phone text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE organizations ADD COLUMN is_active boolean DEFAULT true;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organizations' AND column_name = 'max_users'
  ) THEN
    ALTER TABLE organizations ADD COLUMN max_users integer DEFAULT 50;
  END IF;
END $$;

-- Add is_super_admin to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_super_admin'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_super_admin boolean DEFAULT false;
  END IF;
END $$;

-- Create super_admin_activity_logs table for audit trail
CREATE TABLE IF NOT EXISTS super_admin_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  super_admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE super_admin_activity_logs ENABLE ROW LEVEL SECURITY;

-- Super admin can view their own logs
CREATE POLICY "Super admins can view activity logs"
  ON super_admin_activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

-- Super admin can insert logs
CREATE POLICY "Super admins can insert activity logs"
  ON super_admin_activity_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
    AND super_admin_id = auth.uid()
  );

-- Update profiles policies to allow super admin access
DROP POLICY IF EXISTS "Users can view profiles in their organization" ON profiles;
CREATE POLICY "Users can view profiles in their organization"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

-- Super admin can create profiles for any organization
CREATE POLICY "Super admins can create profiles"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

-- Super admin can update any profile
CREATE POLICY "Super admins can update profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

-- Update organizations policies for super admin
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;
CREATE POLICY "Users can view organizations"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

-- Super admin can create organizations
CREATE POLICY "Super admins can create organizations"
  ON organizations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

-- Super admin can update organizations
CREATE POLICY "Super admins can update organizations"
  ON organizations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = true
    )
  );

-- Create index for subdomain lookups
CREATE INDEX IF NOT EXISTS idx_organizations_subdomain ON organizations(subdomain);

-- Create index for super admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_super_admin ON profiles(is_super_admin) WHERE is_super_admin = true;
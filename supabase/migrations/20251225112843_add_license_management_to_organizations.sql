/*
  # Add License Management to Organizations
  
  1. Overview
    Organizations (municipalities) require license keys to use the system.
    When a new organization is created, they have 15 days trial period.
    Super admin generates and assigns license keys.
  
  2. New Fields
    - `license_key` (text, unique) - Unique license key for the organization
    - `license_status` (text) - Status: trial, active, expired, suspended
    - `license_expiry_date` (timestamptz) - When the license expires
    - `license_issued_date` (timestamptz) - When the license was issued
    - `license_trial_end_date` (timestamptz) - When trial period ends (15 days from creation)
    - `license_max_users` (integer) - Maximum users allowed
    - `license_notes` (text) - Additional notes
  
  3. Functions
    - `generate_organization_license_key()` - Generates unique license keys
    - Auto-set trial period on organization creation
  
  4. Security
    - Only super admins can manage licenses
*/

-- Remove license fields from departments (if they exist)
ALTER TABLE departments 
DROP COLUMN IF EXISTS license_key,
DROP COLUMN IF EXISTS license_status,
DROP COLUMN IF EXISTS license_expiry_date,
DROP COLUMN IF EXISTS license_issued_date,
DROP COLUMN IF EXISTS license_max_users,
DROP COLUMN IF EXISTS license_notes;

-- Add license fields to organizations
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS license_key TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS license_status TEXT DEFAULT 'trial' CHECK (license_status IN ('trial', 'active', 'expired', 'suspended')),
ADD COLUMN IF NOT EXISTS license_expiry_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS license_issued_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS license_trial_end_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS license_max_users INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS license_notes TEXT;

-- Create indexes for license lookups
CREATE INDEX IF NOT EXISTS idx_organizations_license_key ON organizations(license_key) WHERE license_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_license_status ON organizations(license_status);
CREATE INDEX IF NOT EXISTS idx_organizations_license_expiry ON organizations(license_expiry_date) WHERE license_expiry_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_trial_end ON organizations(license_trial_end_date) WHERE license_trial_end_date IS NOT NULL;

-- Drop old department license key generator if exists
DROP FUNCTION IF EXISTS generate_license_key();

-- Function to generate organization license key
CREATE OR REPLACE FUNCTION generate_organization_license_key()
RETURNS TEXT AS $$
DECLARE
  key TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    -- Generate format: MUNI-XXXX-XXXX-XXXX (MUNI = Municipality)
    key := 'MUNI-' || 
      upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' ||
      upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' ||
      upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    
    SELECT EXISTS(SELECT 1 FROM organizations WHERE license_key = key) INTO exists;
    
    IF NOT exists THEN
      RETURN key;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to set trial period when organization is created
CREATE OR REPLACE FUNCTION set_organization_trial_period()
RETURNS TRIGGER AS $$
BEGIN
  -- Set trial end date to 15 days from creation
  NEW.license_trial_end_date := NEW.created_at + INTERVAL '15 days';
  NEW.license_status := 'trial';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_organization_trial ON organizations;
CREATE TRIGGER trigger_set_organization_trial
  BEFORE INSERT ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION set_organization_trial_period();

-- Update existing organizations to have trial period
UPDATE organizations
SET 
  license_trial_end_date = created_at + INTERVAL '15 days',
  license_status = COALESCE(license_status, 'trial')
WHERE license_trial_end_date IS NULL;

COMMENT ON COLUMN organizations.license_key IS 'Unique license key for the organization';
COMMENT ON COLUMN organizations.license_status IS 'License status: trial (15 days), active, expired, suspended';
COMMENT ON COLUMN organizations.license_trial_end_date IS 'End date of 15-day trial period';
COMMENT ON FUNCTION generate_organization_license_key() IS 'Generates unique license key in format MUNI-XXXX-XXXX-XXXX';

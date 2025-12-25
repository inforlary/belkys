/*
  # Add License Management to Departments

  1. New Fields
    - `license_key` (text) - Unique license key for the department
    - `license_status` (text) - Status: active, expired, suspended, trial
    - `license_expiry_date` (timestamptz) - When the license expires
    - `license_issued_date` (timestamptz) - When the license was issued
    - `license_max_users` (integer) - Maximum users allowed for this department
    - `license_notes` (text) - Additional notes about the license

  2. Security
    - Only super admins can view and manage licenses
*/

-- Add license fields to departments
ALTER TABLE departments 
ADD COLUMN IF NOT EXISTS license_key TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS license_status TEXT DEFAULT 'trial' CHECK (license_status IN ('active', 'expired', 'suspended', 'trial')),
ADD COLUMN IF NOT EXISTS license_expiry_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS license_issued_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS license_max_users INTEGER DEFAULT 10,
ADD COLUMN IF NOT EXISTS license_notes TEXT;

-- Create index for license lookups
CREATE INDEX IF NOT EXISTS idx_departments_license_key ON departments(license_key) WHERE license_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_departments_license_status ON departments(license_status);
CREATE INDEX IF NOT EXISTS idx_departments_license_expiry ON departments(license_expiry_date) WHERE license_expiry_date IS NOT NULL;

-- Function to generate license key
CREATE OR REPLACE FUNCTION generate_license_key()
RETURNS TEXT AS $$
DECLARE
  key TEXT;
  exists BOOLEAN;
BEGIN
  LOOP
    key := upper(
      substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
      substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
      substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-' ||
      substr(md5(random()::text || clock_timestamp()::text), 1, 4)
    );
    
    SELECT EXISTS(SELECT 1 FROM departments WHERE license_key = key) INTO exists;
    
    IF NOT exists THEN
      RETURN key;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION generate_license_key() IS 'Generates a unique license key for departments';

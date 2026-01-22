/*
  # Add organization_id to risk_controls and risk_treatments tables

  1. Changes
    - Add `organization_id` column to `risk_controls` table
    - Add `organization_id` column to `risk_treatments` table
    - Populate organization_id from related risk
    - Make organization_id NOT NULL after population
    - Add foreign key constraints
    - Update RLS policies to use organization_id
    
  2. Security
    - Update RLS policies to check organization_id
*/

-- Add organization_id to risk_controls
ALTER TABLE risk_controls 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Populate organization_id from risks table
UPDATE risk_controls rc
SET organization_id = r.organization_id
FROM risks r
WHERE rc.risk_id = r.id AND rc.organization_id IS NULL;

-- Make it NOT NULL
ALTER TABLE risk_controls 
ALTER COLUMN organization_id SET NOT NULL;

-- Add organization_id to risk_treatments
ALTER TABLE risk_treatments 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- Populate organization_id from risks table
UPDATE risk_treatments rt
SET organization_id = r.organization_id
FROM risks r
WHERE rt.risk_id = r.id AND rt.organization_id IS NULL;

-- Make it NOT NULL
ALTER TABLE risk_treatments 
ALTER COLUMN organization_id SET NOT NULL;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_risk_controls_organization_id ON risk_controls(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_treatments_organization_id ON risk_treatments(organization_id);

-- Update RLS policies for risk_controls
DROP POLICY IF EXISTS "Users can view risk controls in their organization" ON risk_controls;
DROP POLICY IF EXISTS "Users can create risk controls in their organization" ON risk_controls;
DROP POLICY IF EXISTS "Users can update risk controls in their organization" ON risk_controls;
DROP POLICY IF EXISTS "Users can delete risk controls in their organization" ON risk_controls;

CREATE POLICY "Users can view risk controls in their organization"
  ON risk_controls FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create risk controls in their organization"
  ON risk_controls FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update risk controls in their organization"
  ON risk_controls FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete risk controls in their organization"
  ON risk_controls FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Update RLS policies for risk_treatments
DROP POLICY IF EXISTS "Users can view risk treatments in their organization" ON risk_treatments;
DROP POLICY IF EXISTS "Users can create risk treatments in their organization" ON risk_treatments;
DROP POLICY IF EXISTS "Users can update risk treatments in their organization" ON risk_treatments;
DROP POLICY IF EXISTS "Users can delete risk treatments in their organization" ON risk_treatments;

CREATE POLICY "Users can view risk treatments in their organization"
  ON risk_treatments FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create risk treatments in their organization"
  ON risk_treatments FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update risk treatments in their organization"
  ON risk_treatments FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete risk treatments in their organization"
  ON risk_treatments FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
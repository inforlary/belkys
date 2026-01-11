/*
  # Fix Risk Indicators - Add Organization ID

  1. Changes
    - Add organization_id to risk_indicators table
    - Update RLS policies to filter by organization_id
    - Add index for better performance

  2. Security
    - Update RLS policies to use organization_id
*/

-- Add organization_id to risk_indicators if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risk_indicators' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE risk_indicators ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update existing records to set organization_id from their related risk
UPDATE risk_indicators ri
SET organization_id = r.organization_id
FROM risks r
WHERE ri.risk_id = r.id
AND ri.organization_id IS NULL;

-- Make organization_id NOT NULL after updating existing records
ALTER TABLE risk_indicators ALTER COLUMN organization_id SET NOT NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_risk_indicators_organization_id ON risk_indicators(organization_id);

-- Update threshold columns to use numeric type instead of varchar
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risk_indicators' 
    AND column_name = 'green_threshold'
    AND data_type = 'character varying'
  ) THEN
    ALTER TABLE risk_indicators 
      ALTER COLUMN green_threshold TYPE DECIMAL(15,4) USING green_threshold::DECIMAL(15,4);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risk_indicators' 
    AND column_name = 'yellow_threshold'
    AND data_type = 'character varying'
  ) THEN
    ALTER TABLE risk_indicators 
      ALTER COLUMN yellow_threshold TYPE DECIMAL(15,4) USING yellow_threshold::DECIMAL(15,4);
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risk_indicators' 
    AND column_name = 'red_threshold'
    AND data_type = 'character varying'
  ) THEN
    ALTER TABLE risk_indicators 
      ALTER COLUMN red_threshold TYPE DECIMAL(15,4) USING red_threshold::DECIMAL(15,4);
  END IF;
END $$;

-- Add responsible_department_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risk_indicators' AND column_name = 'responsible_department_id'
  ) THEN
    ALTER TABLE risk_indicators ADD COLUMN responsible_department_id UUID REFERENCES departments(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view risk indicators in their organization" ON risk_indicators;
DROP POLICY IF EXISTS "Users can create risk indicators in their organization" ON risk_indicators;
DROP POLICY IF EXISTS "Users can update risk indicators in their organization" ON risk_indicators;
DROP POLICY IF EXISTS "Users can delete risk indicators in their organization" ON risk_indicators;

-- Create RLS policies
CREATE POLICY "Users can view risk indicators in their organization"
  ON risk_indicators FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create risk indicators in their organization"
  ON risk_indicators FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update risk indicators in their organization"
  ON risk_indicators FOR UPDATE
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

CREATE POLICY "Users can delete risk indicators in their organization"
  ON risk_indicators FOR DELETE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );
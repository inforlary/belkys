/*
  # Add Risk Settings and Criteria Tables

  1. New Tables
    - `risk_settings` - Organization risk management settings
    - `risk_criteria` - Likelihood and impact criteria definitions

  2. Security
    - Enable RLS with organization-based access
*/

-- Risk Settings
CREATE TABLE IF NOT EXISTS risk_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  risk_appetite VARCHAR(20) DEFAULT 'MEDIUM' CHECK (risk_appetite IN ('LOW', 'MEDIUM', 'HIGH')),
  policy_text TEXT,
  roles_responsibilities TEXT,
  approved_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id)
);

-- Risk Criteria
CREATE TABLE IF NOT EXISTS risk_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE NOT NULL,
  criteria_type VARCHAR(20) NOT NULL CHECK (criteria_type IN ('LIKELIHOOD', 'IMPACT')),
  level INT NOT NULL CHECK (level BETWEEN 1 AND 5),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  percentage_min INT,
  percentage_max INT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, criteria_type, level)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_risk_settings_org ON risk_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_criteria_org ON risk_criteria(organization_id);

-- Enable RLS
ALTER TABLE risk_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_criteria ENABLE ROW LEVEL SECURITY;

-- RLS Policies for risk_settings
CREATE POLICY "Users can view settings in their organization"
  ON risk_settings FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage settings"
  ON risk_settings FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- RLS Policies for risk_criteria
CREATE POLICY "Users can view criteria in their organization"
  ON risk_criteria FOR SELECT
  TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Admins can manage criteria"
  ON risk_criteria FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

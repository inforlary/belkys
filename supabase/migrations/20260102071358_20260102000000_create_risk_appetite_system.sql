/*
  # Create Risk Appetite Management System

  1. New Tables
    - `risk_appetite_settings`
      - Organization-level risk appetite definitions
      - Risk type, max acceptable scores, thresholds
      - Approval tracking and validity periods

    - `risk_appetite_violations`
      - Automatic tracking of appetite breaches
      - Links to risks exceeding appetite
      - Status and resolution tracking

  2. Changes
    - Add appetite violation flags to existing risks
    - Add automated triggers for violation detection
    - Add indexes for performance

  3. Security
    - Enable RLS on all new tables
    - Only admins and vice presidents can manage appetite settings
    - All users can view appetite settings in their organization
    - Automatic violation tracking visible to risk owners and management
*/

-- Create risk appetite settings table
CREATE TABLE IF NOT EXISTS risk_appetite_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  risk_category text NOT NULL CHECK (risk_category IN ('strategic', 'operational', 'financial', 'compliance', 'reputational')),

  -- Maximum acceptable scores
  max_acceptable_score integer CHECK (max_acceptable_score BETWEEN 1 AND 25),
  max_impact integer CHECK (max_impact BETWEEN 1 AND 5),
  max_likelihood integer CHECK (max_likelihood BETWEEN 1 AND 5),

  -- Approval and validity
  approved_by uuid REFERENCES profiles(id),
  approval_date date,
  valid_from date NOT NULL,
  valid_until date,

  -- Status and metadata
  status text CHECK (status IN ('draft', 'approved', 'expired', 'cancelled')) DEFAULT 'draft',
  notes text,

  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- One active appetite per risk category per organization
  UNIQUE(organization_id, risk_category, valid_from)
);

-- Create risk appetite violations tracking table
CREATE TABLE IF NOT EXISTS risk_appetite_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  risk_id uuid NOT NULL REFERENCES ic_risks(id) ON DELETE CASCADE,
  appetite_setting_id uuid REFERENCES risk_appetite_settings(id) ON DELETE SET NULL,

  -- Violation details
  violation_date date DEFAULT CURRENT_DATE,
  residual_score integer NOT NULL,
  appetite_limit integer NOT NULL,
  excess_amount integer GENERATED ALWAYS AS (residual_score - appetite_limit) STORED,

  -- Status tracking
  status text CHECK (status IN ('active', 'acknowledged', 'resolved', 'accepted_with_override')) DEFAULT 'active',
  acknowledged_by uuid REFERENCES profiles(id),
  acknowledged_at timestamptz,
  resolution_notes text,
  resolved_at timestamptz,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_risk_appetite_org ON risk_appetite_settings(organization_id);
CREATE INDEX idx_risk_appetite_category ON risk_appetite_settings(risk_category);
CREATE INDEX idx_risk_appetite_status ON risk_appetite_settings(status);
CREATE INDEX idx_risk_appetite_validity ON risk_appetite_settings(valid_from, valid_until);

CREATE INDEX idx_appetite_violations_org ON risk_appetite_violations(organization_id);
CREATE INDEX idx_appetite_violations_risk ON risk_appetite_violations(risk_id);
CREATE INDEX idx_appetite_violations_status ON risk_appetite_violations(status);
CREATE INDEX idx_appetite_violations_date ON risk_appetite_violations(violation_date);

-- Enable RLS
ALTER TABLE risk_appetite_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_appetite_violations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for risk_appetite_settings

-- View: All authenticated users in organization
DROP POLICY IF EXISTS "Users can view appetite settings in their org" ON risk_appetite_settings;
CREATE POLICY "Users can view appetite settings in their org"
  ON risk_appetite_settings FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Insert: Only admins and vice presidents
DROP POLICY IF EXISTS "Admins can create appetite settings" ON risk_appetite_settings;
CREATE POLICY "Admins can create appetite settings"
  ON risk_appetite_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Update: Only admins and vice presidents for their org
DROP POLICY IF EXISTS "Admins can update appetite settings" ON risk_appetite_settings;
CREATE POLICY "Admins can update appetite settings"
  ON risk_appetite_settings FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Delete: Only admins for draft settings
DROP POLICY IF EXISTS "Admins can delete draft appetite settings" ON risk_appetite_settings;
CREATE POLICY "Admins can delete draft appetite settings"
  ON risk_appetite_settings FOR DELETE
  TO authenticated
  USING (
    status = 'draft' AND (
      organization_id IN (
        SELECT organization_id FROM profiles
        WHERE id = auth.uid() AND role IN ('admin', 'vice_president')
      )
      OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
    )
  );

-- RLS Policies for risk_appetite_violations

-- View: All users in organization
DROP POLICY IF EXISTS "Users can view violations in their org" ON risk_appetite_violations;
CREATE POLICY "Users can view violations in their org"
  ON risk_appetite_violations FOR SELECT
  TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Insert: System-generated (will be done via triggers/functions)
DROP POLICY IF EXISTS "System can create violations" ON risk_appetite_violations;
CREATE POLICY "System can create violations"
  ON risk_appetite_violations FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Update: Admins and risk owners
DROP POLICY IF EXISTS "Admins and risk owners can update violations" ON risk_appetite_violations;
CREATE POLICY "Admins and risk owners can update violations"
  ON risk_appetite_violations FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'vice_president', 'director')
    )
    OR risk_id IN (SELECT id FROM ic_risks WHERE risk_owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)
  );

-- Function to check and create appetite violations
CREATE OR REPLACE FUNCTION check_risk_appetite_violation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_appetite_setting risk_appetite_settings;
  v_existing_violation uuid;
BEGIN
  -- Only check when residual score is updated or created
  IF NEW.residual_score IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get active appetite setting for this risk category
  SELECT * INTO v_appetite_setting
  FROM risk_appetite_settings
  WHERE organization_id = NEW.organization_id
    AND risk_category = NEW.risk_category
    AND status = 'approved'
    AND valid_from <= CURRENT_DATE
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
  ORDER BY valid_from DESC
  LIMIT 1;

  -- If no appetite setting exists, skip
  IF v_appetite_setting.id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if residual score exceeds appetite
  IF NEW.residual_score > v_appetite_setting.max_acceptable_score THEN
    -- Check if violation already exists
    SELECT id INTO v_existing_violation
    FROM risk_appetite_violations
    WHERE risk_id = NEW.id
      AND status = 'active';

    -- Create or update violation
    IF v_existing_violation IS NULL THEN
      INSERT INTO risk_appetite_violations (
        organization_id,
        risk_id,
        appetite_setting_id,
        residual_score,
        appetite_limit,
        status
      ) VALUES (
        NEW.organization_id,
        NEW.id,
        v_appetite_setting.id,
        NEW.residual_score,
        v_appetite_setting.max_acceptable_score,
        'active'
      );
    ELSE
      -- Update existing violation
      UPDATE risk_appetite_violations
      SET residual_score = NEW.residual_score,
          appetite_limit = v_appetite_setting.max_acceptable_score,
          updated_at = now()
      WHERE id = v_existing_violation;
    END IF;

    -- Update risk metadata to flag violation
    NEW.metadata = jsonb_set(
      COALESCE(NEW.metadata, '{}'::jsonb),
      '{appetite_violation}',
      jsonb_build_object(
        'status', 'violation',
        'last_check', now(),
        'setting_id', v_appetite_setting.id,
        'limit', v_appetite_setting.max_acceptable_score
      )
    );
  ELSE
    -- Risk is within appetite, resolve any active violations
    UPDATE risk_appetite_violations
    SET status = 'resolved',
        resolution_notes = 'Risk score reduced below appetite threshold',
        resolved_at = now(),
        updated_at = now()
    WHERE risk_id = NEW.id
      AND status = 'active';

    -- Clear violation flag from metadata
    IF NEW.metadata ? 'appetite_violation' THEN
      NEW.metadata = jsonb_set(
        NEW.metadata,
        '{appetite_violation}',
        jsonb_build_object('status', 'compliant', 'last_check', now())
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on ic_risks for automatic violation detection
DROP TRIGGER IF EXISTS trg_check_risk_appetite ON ic_risks;
CREATE TRIGGER trg_check_risk_appetite
  BEFORE INSERT OR UPDATE OF residual_likelihood, residual_impact
  ON ic_risks
  FOR EACH ROW
  EXECUTE FUNCTION check_risk_appetite_violation();

-- Function to get active appetite setting for a risk category
CREATE OR REPLACE FUNCTION get_active_risk_appetite(
  p_organization_id uuid,
  p_risk_category text
)
RETURNS risk_appetite_settings
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM risk_appetite_settings
  WHERE organization_id = p_organization_id
    AND risk_category = p_risk_category
    AND status = 'approved'
    AND valid_from <= CURRENT_DATE
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE)
  ORDER BY valid_from DESC
  LIMIT 1;
$$;

-- Function to count appetite violations by category
CREATE OR REPLACE FUNCTION count_appetite_violations(p_organization_id uuid)
RETURNS TABLE (
  risk_category text,
  active_violations bigint,
  total_risks bigint,
  violation_rate numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.risk_category,
    COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'active') as active_violations,
    COUNT(DISTINCT r.id) as total_risks,
    ROUND(
      (COUNT(DISTINCT v.id) FILTER (WHERE v.status = 'active')::numeric /
       NULLIF(COUNT(DISTINCT r.id), 0) * 100),
      2
    ) as violation_rate
  FROM ic_risks r
  LEFT JOIN risk_appetite_violations v ON v.risk_id = r.id AND v.status = 'active'
  WHERE r.organization_id = p_organization_id
  GROUP BY r.risk_category;
$$;

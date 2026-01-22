/*
  # Create Control Execution and Risk Improvement System

  1. New Tables
    - `control_executions` - Tracks actual control applications/tests with evidence
    - `risk_improvement_actions` - Renamed from risk_treatments for clarity

  2. Changes to Existing Tables
    - `risk_controls` - Add test_frequency column if not exists

  3. Functions
    - calculate_control_operating_effectiveness() - Calculates based on recent test results
    - calculate_residual_risk() - Calculates residual risk from inherent risk and controls
    - update_risk_residual_scores() - Updates risk residual values

  4. Triggers
    - Auto-update operating_effectiveness when control_executions are added
    - Auto-update residual_risk when controls or their effectiveness changes

  5. Security
    - Enable RLS on all new tables
    - Policies for authenticated users based on organization and role
*/

-- ============================================================================
-- PART 1: UPDATE EXISTING TABLES
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'risk_controls' AND column_name = 'test_frequency'
  ) THEN
    ALTER TABLE risk_controls ADD COLUMN test_frequency text DEFAULT 'MONTHLY' CHECK (test_frequency IN ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY', 'AD_HOC', 'CONTINUOUS'));
  END IF;
END $$;

UPDATE risk_controls SET design_effectiveness = 3 WHERE design_effectiveness IS NULL;
UPDATE risk_controls SET operating_effectiveness = 3 WHERE operating_effectiveness IS NULL;

-- ============================================================================
-- PART 2: CREATE CONTROL EXECUTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS control_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id uuid NOT NULL REFERENCES risk_controls(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  execution_date date NOT NULL DEFAULT CURRENT_DATE,
  executed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,

  status text NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'PARTIAL', 'NOT_APPLICABLE')),
  effectiveness_rating integer CHECK (effectiveness_rating >= 1 AND effectiveness_rating <= 5),

  evidence_file_path text,
  evidence_description text,
  notes text,

  issues_found boolean DEFAULT false,
  issues_description text,
  corrective_actions_needed text,
  corrective_action_deadline date,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_control_executions_control_id ON control_executions(control_id);
CREATE INDEX IF NOT EXISTS idx_control_executions_organization_id ON control_executions(organization_id);
CREATE INDEX IF NOT EXISTS idx_control_executions_execution_date ON control_executions(execution_date DESC);
CREATE INDEX IF NOT EXISTS idx_control_executions_status ON control_executions(status);
CREATE INDEX IF NOT EXISTS idx_control_executions_executed_by ON control_executions(executed_by);

ALTER TABLE control_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view executions in their organization"
  ON control_executions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create executions in their organization"
  ON control_executions FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update executions in their organization"
  ON control_executions FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and directors can delete executions"
  ON control_executions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = control_executions.organization_id
      AND role IN ('admin', 'director')
    )
  );

-- ============================================================================
-- PART 3: CREATE RISK_IMPROVEMENT_ACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS risk_improvement_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id uuid NOT NULL REFERENCES risks(id) ON DELETE CASCADE,
  target_control_id uuid REFERENCES risk_controls(id) ON DELETE SET NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  action_type text NOT NULL DEFAULT 'IMPROVE_CONTROL' CHECK (action_type IN (
    'NEW_CONTROL',
    'IMPROVE_CONTROL',
    'AUTOMATE_CONTROL',
    'TRANSFER_RISK',
    'ELIMINATE_RISK',
    'ACCEPT_RISK'
  )),
  title text NOT NULL,
  description text,

  responsible_person uuid REFERENCES profiles(id) ON DELETE SET NULL,
  responsible_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,

  status text NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD')),
  progress_percent integer DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),

  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,

  expected_residual_likelihood integer CHECK (expected_residual_likelihood >= 1 AND expected_residual_likelihood <= 5),
  expected_residual_impact integer CHECK (expected_residual_impact >= 1 AND expected_residual_impact <= 5),

  estimated_cost numeric(15,2),
  actual_cost numeric(15,2),
  resources_required text,

  approval_status text DEFAULT 'DRAFT' CHECK (approval_status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,

  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_risk_improvement_actions_risk_id ON risk_improvement_actions(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_improvement_actions_target_control_id ON risk_improvement_actions(target_control_id);
CREATE INDEX IF NOT EXISTS idx_risk_improvement_actions_organization_id ON risk_improvement_actions(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_improvement_actions_status ON risk_improvement_actions(status);
CREATE INDEX IF NOT EXISTS idx_risk_improvement_actions_action_type ON risk_improvement_actions(action_type);

ALTER TABLE risk_improvement_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view improvement actions in their organization"
  ON risk_improvement_actions FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can create improvement actions in their organization"
  ON risk_improvement_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update improvement actions in their organization"
  ON risk_improvement_actions FOR UPDATE
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Admins and directors can delete improvement actions"
  ON risk_improvement_actions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND organization_id = risk_improvement_actions.organization_id
      AND role IN ('admin', 'director')
    )
  );

-- ============================================================================
-- PART 4: AUTOMATIC CALCULATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_control_operating_effectiveness(p_control_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recent_tests_count integer;
  v_successful_tests_count integer;
  v_average_effectiveness numeric;
  v_success_rate numeric;
  v_design_effectiveness integer;
  v_final_effectiveness integer;
BEGIN
  SELECT design_effectiveness INTO v_design_effectiveness
  FROM risk_controls
  WHERE id = p_control_id;

  IF v_design_effectiveness IS NULL THEN
    v_design_effectiveness := 3;
  END IF;

  SELECT COUNT(*) INTO v_recent_tests_count
  FROM control_executions
  WHERE control_id = p_control_id
    AND execution_date >= CURRENT_DATE - INTERVAL '3 months'
    AND status IN ('COMPLETED', 'FAILED', 'PARTIAL');

  IF v_recent_tests_count = 0 THEN
    RETURN v_design_effectiveness;
  END IF;

  SELECT COUNT(*) INTO v_successful_tests_count
  FROM control_executions
  WHERE control_id = p_control_id
    AND execution_date >= CURRENT_DATE - INTERVAL '3 months'
    AND status = 'COMPLETED'
    AND issues_found = false;

  SELECT AVG(effectiveness_rating) INTO v_average_effectiveness
  FROM control_executions
  WHERE control_id = p_control_id
    AND execution_date >= CURRENT_DATE - INTERVAL '3 months'
    AND effectiveness_rating IS NOT NULL;

  v_success_rate := v_successful_tests_count::numeric / v_recent_tests_count::numeric;

  IF v_average_effectiveness IS NOT NULL THEN
    v_final_effectiveness := ROUND(
      (v_design_effectiveness * v_success_rate * v_average_effectiveness) / 5
    );
  ELSE
    v_final_effectiveness := ROUND(v_design_effectiveness * v_success_rate);
  END IF;

  v_final_effectiveness := GREATEST(1, LEAST(5, v_final_effectiveness));

  RETURN v_final_effectiveness;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_residual_risk_score(
  p_inherent_likelihood integer,
  p_inherent_impact integer,
  p_controls_json jsonb
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_control jsonb;
  v_control_effectiveness numeric := 1.0;
  v_individual_effectiveness numeric;
BEGIN
  FOR v_control IN SELECT * FROM jsonb_array_elements(p_controls_json)
  LOOP
    v_individual_effectiveness := (v_control->>'operating_effectiveness')::integer / 5.0;
    v_control_effectiveness := v_control_effectiveness * (1 - v_individual_effectiveness);
  END LOOP;

  RETURN GREATEST(1, ROUND(p_inherent_likelihood * p_inherent_impact * v_control_effectiveness))::integer;
END;
$$;

CREATE OR REPLACE FUNCTION update_risk_residual_scores(p_risk_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inherent_likelihood integer;
  v_inherent_impact integer;
  v_controls_json jsonb;
  v_residual_score integer;
  v_residual_likelihood integer;
  v_residual_impact integer;
  v_reduction_factor numeric;
BEGIN
  SELECT inherent_likelihood, inherent_impact
  INTO v_inherent_likelihood, v_inherent_impact
  FROM risks
  WHERE id = p_risk_id;

  IF v_inherent_likelihood IS NULL OR v_inherent_impact IS NULL THEN
    RETURN;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'operating_effectiveness', COALESCE(operating_effectiveness, design_effectiveness, 3)
    )
  )
  INTO v_controls_json
  FROM risk_controls
  WHERE risk_id = p_risk_id
    AND is_active = true;

  IF v_controls_json IS NULL THEN
    UPDATE risks
    SET
      residual_likelihood = v_inherent_likelihood,
      residual_impact = v_inherent_impact,
      updated_at = now()
    WHERE id = p_risk_id;
    RETURN;
  END IF;

  v_residual_score := calculate_residual_risk_score(
    v_inherent_likelihood,
    v_inherent_impact,
    v_controls_json
  );

  v_reduction_factor := v_residual_score::numeric / NULLIF((v_inherent_likelihood * v_inherent_impact), 0)::numeric;
  v_reduction_factor := COALESCE(v_reduction_factor, 1.0);
  
  v_residual_likelihood := GREATEST(1, ROUND(v_inherent_likelihood * SQRT(v_reduction_factor)));
  v_residual_impact := GREATEST(1, ROUND(v_inherent_impact * SQRT(v_reduction_factor)));

  UPDATE risks
  SET
    residual_likelihood = v_residual_likelihood,
    residual_impact = v_residual_impact,
    updated_at = now()
  WHERE id = p_risk_id;
END;
$$;

-- ============================================================================
-- PART 5: TRIGGERS
-- ============================================================================

CREATE OR REPLACE FUNCTION trigger_update_control_operating_effectiveness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE risk_controls
  SET
    operating_effectiveness = calculate_control_operating_effectiveness(NEW.control_id),
    last_test_date = NEW.execution_date,
    updated_at = now()
  WHERE id = NEW.control_id;

  PERFORM update_risk_residual_scores(
    (SELECT risk_id FROM risk_controls WHERE id = NEW.control_id)
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_control_execution_updates_effectiveness ON control_executions;
CREATE TRIGGER trigger_control_execution_updates_effectiveness
  AFTER INSERT OR UPDATE ON control_executions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_control_operating_effectiveness();

CREATE OR REPLACE FUNCTION trigger_update_residual_risk_on_control_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_risk_residual_scores(OLD.risk_id);
    RETURN OLD;
  ELSE
    PERFORM update_risk_residual_scores(NEW.risk_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trigger_control_change_updates_residual_risk ON risk_controls;
CREATE TRIGGER trigger_control_change_updates_residual_risk
  AFTER INSERT OR UPDATE OR DELETE ON risk_controls
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_residual_risk_on_control_change();

-- ============================================================================
-- PART 6: HELPER VIEWS
-- ============================================================================

CREATE OR REPLACE VIEW v_control_testing_status AS
SELECT
  rc.id as control_id,
  rc.name as control_name,
  rc.risk_id,
  rc.design_effectiveness,
  rc.operating_effectiveness,
  rc.control_nature,
  COALESCE(rc.test_frequency, rc.frequency) as test_frequency,
  rc.last_test_date,

  COUNT(ce.id) FILTER (WHERE ce.execution_date >= CURRENT_DATE - INTERVAL '3 months') as tests_last_3_months,
  COUNT(ce.id) FILTER (WHERE ce.execution_date >= CURRENT_DATE - INTERVAL '3 months' AND ce.status = 'COMPLETED') as successful_tests,
  COUNT(ce.id) FILTER (WHERE ce.execution_date >= CURRENT_DATE - INTERVAL '3 months' AND ce.issues_found = true) as tests_with_issues,

  MAX(ce.execution_date) as latest_execution_date,

  CASE
    WHEN COALESCE(rc.test_frequency, rc.frequency) = 'DAILY' AND (rc.last_test_date IS NULL OR rc.last_test_date < CURRENT_DATE - INTERVAL '1 day') THEN true
    WHEN COALESCE(rc.test_frequency, rc.frequency) = 'WEEKLY' AND (rc.last_test_date IS NULL OR rc.last_test_date < CURRENT_DATE - INTERVAL '7 days') THEN true
    WHEN COALESCE(rc.test_frequency, rc.frequency) = 'MONTHLY' AND (rc.last_test_date IS NULL OR rc.last_test_date < CURRENT_DATE - INTERVAL '30 days') THEN true
    WHEN COALESCE(rc.test_frequency, rc.frequency) = 'QUARTERLY' AND (rc.last_test_date IS NULL OR rc.last_test_date < CURRENT_DATE - INTERVAL '90 days') THEN true
    WHEN COALESCE(rc.test_frequency, rc.frequency) = 'ANNUALLY' AND (rc.last_test_date IS NULL OR rc.last_test_date < CURRENT_DATE - INTERVAL '365 days') THEN true
    ELSE false
  END as is_test_overdue

FROM risk_controls rc
LEFT JOIN control_executions ce ON ce.control_id = rc.id
GROUP BY rc.id, rc.name, rc.risk_id,
         rc.design_effectiveness, rc.operating_effectiveness,
         rc.control_nature, rc.test_frequency, rc.frequency, rc.last_test_date;

CREATE OR REPLACE VIEW v_risk_control_effectiveness AS
SELECT
  r.id as risk_id,
  r.code as risk_code,
  r.name as risk_name,
  r.organization_id,
  r.inherent_likelihood,
  r.inherent_impact,
  r.inherent_likelihood * r.inherent_impact as inherent_score,
  r.residual_likelihood,
  r.residual_impact,
  r.residual_likelihood * r.residual_impact as residual_score,

  COUNT(rc.id) as total_controls,
  COUNT(rc.id) FILTER (WHERE rc.is_active = true) as active_controls,
  AVG(rc.design_effectiveness) FILTER (WHERE rc.is_active = true) as avg_design_effectiveness,
  AVG(rc.operating_effectiveness) FILTER (WHERE rc.is_active = true) as avg_operating_effectiveness,

  ((r.inherent_likelihood * r.inherent_impact) - (r.residual_likelihood * r.residual_impact))::numeric /
    NULLIF((r.inherent_likelihood * r.inherent_impact), 0) * 100 as risk_reduction_percent

FROM risks r
LEFT JOIN risk_controls rc ON rc.risk_id = r.id
GROUP BY r.id, r.code, r.name, r.organization_id,
         r.inherent_likelihood, r.inherent_impact,
         r.residual_likelihood, r.residual_impact;

COMMENT ON TABLE control_executions IS 'Records of actual control applications/tests with evidence and results';
COMMENT ON TABLE risk_improvement_actions IS 'Risk improvement projects and initiatives (formerly risk_treatments)';

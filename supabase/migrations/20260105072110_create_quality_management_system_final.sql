/*
  # Quality Management System

  ## New Tables
  1. quality_policies - Quality policies
  2. quality_objectives - Quality objectives linked to goals
  3. iso_standards - ISO standards tracking
  4. quality_compliance_assessments - Compliance assessments
  5. customer_satisfaction_surveys - Satisfaction tracking
  6. quality_indicators - Quality KPIs
  7. process_performance_monitoring - Process monitoring
  8. quality_audits - Quality audits
  9. improvement_suggestions - Improvement ideas
  10. quality_management_reviews - Management reviews

  ## Security
  - RLS enabled with efficient policies
*/

CREATE TABLE IF NOT EXISTS quality_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  effective_date date NOT NULL,
  review_date date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'under_review', 'archived')),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quality_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  budget_period_id uuid NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  strategic_goal_id uuid REFERENCES goals(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  target_value numeric,
  measurement_unit text,
  responsible_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  responsible_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'achieved', 'not_achieved')),
  achievement_percentage numeric DEFAULT 0 CHECK (achievement_percentage >= 0 AND achievement_percentage <= 100),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS iso_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  standard_code text NOT NULL,
  standard_name text NOT NULL,
  category text NOT NULL DEFAULT 'iso' CHECK (category IN ('iso', 'sector_specific', 'internal')),
  description text,
  requirements jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_iso_standards_unique ON iso_standards(COALESCE(organization_id::text, 'global'), standard_code);

CREATE TABLE IF NOT EXISTS quality_compliance_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  iso_standard_id uuid NOT NULL REFERENCES iso_standards(id) ON DELETE CASCADE,
  assessment_date date NOT NULL,
  assessed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  compliance_score numeric CHECK (compliance_score >= 0 AND compliance_score <= 100),
  status text NOT NULL CHECK (status IN ('compliant', 'partially_compliant', 'non_compliant')),
  findings text,
  action_plan text,
  next_assessment_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customer_satisfaction_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  budget_period_id uuid NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  survey_title text NOT NULL,
  survey_date date NOT NULL,
  stakeholder_type text NOT NULL CHECK (stakeholder_type IN ('internal', 'external', 'citizen', 'business')),
  total_responses integer DEFAULT 0,
  satisfaction_score numeric CHECK (satisfaction_score >= 0 AND satisfaction_score <= 10),
  questions jsonb DEFAULT '[]'::jsonb,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  analysis text,
  improvement_actions text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quality_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  indicator_id uuid REFERENCES indicators(id) ON DELETE SET NULL,
  quality_objective_id uuid REFERENCES quality_objectives(id) ON DELETE SET NULL,
  name text NOT NULL,
  formula text,
  target_value numeric,
  measurement_frequency text NOT NULL CHECK (measurement_frequency IN ('monthly', 'quarterly', 'annual')),
  responsible_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS process_performance_monitoring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  ic_process_id uuid REFERENCES ic_processes(id) ON DELETE SET NULL,
  process_name text NOT NULL,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  measurement_period text NOT NULL,
  efficiency_score numeric CHECK (efficiency_score >= 0 AND efficiency_score <= 100),
  effectiveness_score numeric CHECK (effectiveness_score >= 0 AND effectiveness_score <= 100),
  quality_score numeric CHECK (quality_score >= 0 AND quality_score <= 100),
  issues_identified text,
  improvement_opportunities text,
  measured_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  measured_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quality_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  budget_period_id uuid NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  audit_code text NOT NULL,
  audit_title text NOT NULL,
  audit_type text NOT NULL CHECK (audit_type IN ('process', 'product', 'system', 'compliance')),
  scope text NOT NULL,
  planned_date date NOT NULL,
  actual_date date,
  auditor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  auditee_department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  iso_standard_id uuid REFERENCES iso_standards(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'cancelled')),
  findings_summary text,
  conformities integer DEFAULT 0,
  minor_nonconformities integer DEFAULT 0,
  major_nonconformities integer DEFAULT 0,
  opportunities_for_improvement integer DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, audit_code)
);

CREATE TABLE IF NOT EXISTS improvement_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  suggestion_code text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  suggested_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('process', 'quality', 'cost', 'safety', 'environment')),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'under_review', 'approved', 'implemented', 'rejected')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  estimated_benefit text,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  review_notes text,
  implementation_date date,
  actual_benefit text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, suggestion_code)
);

CREATE TABLE IF NOT EXISTS quality_management_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  budget_period_id uuid NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  review_date date NOT NULL,
  review_type text NOT NULL CHECK (review_type IN ('quarterly', 'annual', 'special')),
  participants jsonb DEFAULT '[]'::jsonb,
  agenda text,
  performance_summary text,
  customer_feedback_summary text,
  audit_results_summary text,
  resource_adequacy text,
  improvement_actions jsonb DEFAULT '[]'::jsonb,
  decisions text,
  next_review_date date,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_quality_policies_org ON quality_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_quality_objectives_org_period ON quality_objectives(organization_id, budget_period_id);
CREATE INDEX IF NOT EXISTS idx_quality_objectives_goal ON quality_objectives(strategic_goal_id);
CREATE INDEX IF NOT EXISTS idx_iso_standards_org ON iso_standards(organization_id);
CREATE INDEX IF NOT EXISTS idx_compliance_assessments_org ON quality_compliance_assessments(organization_id);
CREATE INDEX IF NOT EXISTS idx_customer_surveys_org_period ON customer_satisfaction_surveys(organization_id, budget_period_id);
CREATE INDEX IF NOT EXISTS idx_quality_indicators_org ON quality_indicators(organization_id);
CREATE INDEX IF NOT EXISTS idx_process_monitoring_org ON process_performance_monitoring(organization_id);
CREATE INDEX IF NOT EXISTS idx_quality_audits_org_period ON quality_audits(organization_id, budget_period_id);
CREATE INDEX IF NOT EXISTS idx_improvement_suggestions_org ON improvement_suggestions(organization_id);
CREATE INDEX IF NOT EXISTS idx_quality_reviews_org_period ON quality_management_reviews(organization_id, budget_period_id);

ALTER TABLE quality_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_objectives ENABLE ROW LEVEL SECURITY;
ALTER TABLE iso_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_compliance_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_satisfaction_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE process_performance_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE improvement_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_management_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select_quality_policies" ON quality_policies FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admin_all_quality_policies" ON quality_policies FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = quality_policies.organization_id AND role IN ('admin', 'quality_manager')));

CREATE POLICY "org_select_quality_objectives" ON quality_objectives FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admin_all_quality_objectives" ON quality_objectives FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = quality_objectives.organization_id AND role IN ('admin', 'quality_manager', 'director')));

CREATE POLICY "all_select_iso_standards" ON iso_standards FOR SELECT TO authenticated
  USING (organization_id IS NULL OR organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admin_all_iso_standards" ON iso_standards FOR ALL TO authenticated
  USING (organization_id IS NULL OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = iso_standards.organization_id AND role IN ('admin', 'quality_manager')));

CREATE POLICY "org_select_compliance" ON quality_compliance_assessments FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "auditor_all_compliance" ON quality_compliance_assessments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = quality_compliance_assessments.organization_id AND role IN ('admin', 'quality_manager', 'auditor')));

CREATE POLICY "org_select_surveys" ON customer_satisfaction_surveys FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admin_all_surveys" ON customer_satisfaction_surveys FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = customer_satisfaction_surveys.organization_id AND role IN ('admin', 'quality_manager', 'director')));

CREATE POLICY "org_select_quality_indicators" ON quality_indicators FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admin_all_quality_indicators" ON quality_indicators FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = quality_indicators.organization_id AND role IN ('admin', 'quality_manager')));

CREATE POLICY "org_select_process_monitoring" ON process_performance_monitoring FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "director_all_process_monitoring" ON process_performance_monitoring FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = process_performance_monitoring.organization_id AND role IN ('admin', 'quality_manager', 'director')));

CREATE POLICY "org_select_quality_audits" ON quality_audits FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "auditor_all_quality_audits" ON quality_audits FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = quality_audits.organization_id AND role IN ('admin', 'quality_manager', 'auditor')));

CREATE POLICY "org_select_suggestions" ON improvement_suggestions FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "user_insert_suggestions" ON improvement_suggestions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = improvement_suggestions.organization_id) AND suggested_by = auth.uid());

CREATE POLICY "admin_update_suggestions" ON improvement_suggestions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = improvement_suggestions.organization_id AND role IN ('admin', 'quality_manager', 'director')));

CREATE POLICY "org_select_quality_reviews" ON quality_management_reviews FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "admin_all_quality_reviews" ON quality_management_reviews FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = quality_management_reviews.organization_id AND role IN ('admin', 'quality_manager')));

CREATE OR REPLACE FUNCTION generate_quality_audit_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
  org_code text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM quality_audits
  WHERE organization_id = NEW.organization_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NEW.created_at);
  SELECT code INTO org_code FROM organizations WHERE id = NEW.organization_id;
  NEW.audit_code := org_code || '-QA-' || TO_CHAR(NEW.created_at, 'YYYY') || '-' || LPAD(next_num::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_quality_audit_code BEFORE INSERT ON quality_audits
FOR EACH ROW WHEN (NEW.audit_code IS NULL OR NEW.audit_code = '') EXECUTE FUNCTION generate_quality_audit_code();

CREATE OR REPLACE FUNCTION generate_suggestion_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
  org_code text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM improvement_suggestions
  WHERE organization_id = NEW.organization_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NEW.created_at);
  SELECT code INTO org_code FROM organizations WHERE id = NEW.organization_id;
  NEW.suggestion_code := org_code || '-IS-' || TO_CHAR(NEW.created_at, 'YYYY') || '-' || LPAD(next_num::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_suggestion_code BEFORE INSERT ON improvement_suggestions
FOR EACH ROW WHEN (NEW.suggestion_code IS NULL OR NEW.suggestion_code = '') EXECUTE FUNCTION generate_suggestion_code();
/*
  # Risk Culture, Legal Compliance & Continuous Improvement Systems

  ## Overview
  Three integrated systems completing the governance framework:
  1. Risk Culture Management - Organizational risk awareness and culture
  2. Legal Compliance Tracking - Legislation monitoring and compliance
  3. Continuous Improvement Cycle - Lessons learned and feedback loops

  ## New Tables

  ### Risk Culture Management
  1. risk_culture_assessments - Organizational risk culture assessments
  2. risk_culture_indicators - Risk culture KPIs
  3. risk_culture_training - Training and awareness programs
  4. risk_culture_surveys - Employee risk awareness surveys

  ### Legal Compliance Tracking
  5. legal_regulations - Laws and regulations database
  6. compliance_requirements - Specific compliance requirements
  7. compliance_assessments - Compliance status assessments
  8. compliance_violations - Violation tracking
  9. compliance_training - Compliance training records

  ### Continuous Improvement
  10. lessons_learned - Lessons from projects/incidents
  11. best_practices - Best practice repository
  12. improvement_initiatives - Strategic improvement initiatives
  13. knowledge_base - Organizational knowledge repository

  ## Integration
  Links to risks, controls, audits, quality, and strategic goals

  ## Security
  RLS enabled for all tables
*/

-- Risk Culture Management Tables

CREATE TABLE IF NOT EXISTS risk_culture_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  budget_period_id uuid NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  assessment_code text NOT NULL,
  assessment_title text NOT NULL,
  assessment_date date NOT NULL,
  assessment_method text NOT NULL CHECK (assessment_method IN ('survey', 'interview', 'observation', 'document_review', 'workshop')),
  scope text NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  overall_maturity_level text CHECK (overall_maturity_level IN ('initial', 'developing', 'defined', 'managed', 'optimized')),
  risk_awareness_score numeric CHECK (risk_awareness_score >= 0 AND risk_awareness_score <= 100),
  risk_communication_score numeric CHECK (risk_communication_score >= 0 AND risk_communication_score <= 100),
  risk_accountability_score numeric CHECK (risk_accountability_score >= 0 AND risk_accountability_score <= 100),
  risk_integration_score numeric CHECK (risk_integration_score >= 0 AND risk_integration_score <= 100),
  key_findings text,
  strengths text,
  weaknesses text,
  recommendations text,
  assessed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, assessment_code)
);

CREATE TABLE IF NOT EXISTS risk_culture_indicators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  indicator_name text NOT NULL,
  indicator_description text,
  measurement_frequency text NOT NULL CHECK (measurement_frequency IN ('monthly', 'quarterly', 'semi_annual', 'annual')),
  target_value numeric,
  current_value numeric,
  trend text CHECK (trend IN ('improving', 'stable', 'declining')),
  responsible_user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS risk_culture_training (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  training_code text NOT NULL,
  training_title text NOT NULL,
  training_type text NOT NULL CHECK (training_type IN ('awareness', 'technical', 'leadership', 'certification', 'workshop')),
  target_audience text NOT NULL CHECK (target_audience IN ('all_staff', 'management', 'risk_owners', 'specific_department', 'new_employees')),
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  planned_date date NOT NULL,
  actual_date date,
  duration_hours numeric,
  trainer text,
  location text,
  participants_planned integer,
  participants_actual integer,
  training_materials text,
  assessment_method text,
  average_score numeric,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled', 'postponed')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, training_code)
);

CREATE TABLE IF NOT EXISTS risk_culture_surveys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  budget_period_id uuid NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  survey_code text NOT NULL,
  survey_title text NOT NULL,
  survey_date date NOT NULL,
  target_group text NOT NULL,
  questions jsonb DEFAULT '[]'::jsonb,
  total_invitations integer DEFAULT 0,
  total_responses integer DEFAULT 0,
  response_rate numeric,
  average_score numeric,
  results_summary text,
  action_items text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, survey_code)
);

-- Legal Compliance Tracking Tables

CREATE TABLE IF NOT EXISTS legal_regulations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation_code text NOT NULL UNIQUE,
  regulation_title text NOT NULL,
  regulation_type text NOT NULL CHECK (regulation_type IN ('law', 'decree', 'regulation', 'circular', 'standard', 'guideline', 'international')),
  issuing_authority text NOT NULL,
  publication_date date NOT NULL,
  effective_date date NOT NULL,
  scope text,
  summary text,
  full_text_url text,
  related_regulations jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  superseded_by uuid REFERENCES legal_regulations(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  legal_regulation_id uuid NOT NULL REFERENCES legal_regulations(id) ON DELETE CASCADE,
  requirement_code text NOT NULL,
  requirement_title text NOT NULL,
  requirement_description text NOT NULL,
  applicability text NOT NULL,
  responsible_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  responsible_person_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  compliance_deadline date,
  review_frequency text CHECK (review_frequency IN ('monthly', 'quarterly', 'semi_annual', 'annual', 'ad_hoc')),
  last_review_date date,
  next_review_date date,
  compliance_status text NOT NULL DEFAULT 'pending' CHECK (compliance_status IN ('pending', 'compliant', 'partially_compliant', 'non_compliant', 'not_applicable')),
  evidence_required text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, requirement_code)
);

CREATE TABLE IF NOT EXISTS compliance_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_requirement_id uuid NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  assessment_date date NOT NULL,
  assessed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  assessment_method text NOT NULL,
  compliance_level numeric CHECK (compliance_level >= 0 AND compliance_level <= 100),
  findings text,
  evidence_reviewed text,
  gaps_identified text,
  corrective_actions_needed text,
  next_assessment_date date,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS compliance_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  compliance_requirement_id uuid NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
  violation_code text NOT NULL,
  violation_date date NOT NULL,
  discovered_date date NOT NULL,
  discovered_by text,
  violation_description text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  affected_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  root_cause text,
  immediate_action_taken text,
  corrective_action_plan text,
  responsible_person_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  target_resolution_date date,
  actual_resolution_date date,
  penalties_incurred numeric,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'action_plan', 'resolved', 'closed')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, violation_code)
);

CREATE TABLE IF NOT EXISTS compliance_training (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  legal_regulation_id uuid REFERENCES legal_regulations(id) ON DELETE SET NULL,
  training_code text NOT NULL,
  training_title text NOT NULL,
  training_date date NOT NULL,
  participants jsonb DEFAULT '[]'::jsonb,
  trainer text,
  duration_hours numeric,
  attendance_count integer,
  training_materials text,
  quiz_administered boolean DEFAULT false,
  average_quiz_score numeric,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, training_code)
);

-- Continuous Improvement Tables

CREATE TABLE IF NOT EXISTS lessons_learned (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lesson_code text NOT NULL,
  lesson_title text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('project', 'incident', 'audit', 'complaint', 'near_miss', 'success', 'failure')),
  source_reference text,
  date_identified date NOT NULL,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  situation_description text NOT NULL,
  what_went_well text,
  what_went_wrong text,
  root_cause text,
  lesson_learned text NOT NULL,
  recommendations text NOT NULL,
  applicable_to text,
  category text NOT NULL CHECK (category IN ('process', 'people', 'technology', 'strategy', 'risk', 'quality', 'project_management')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'documented' CHECK (status IN ('documented', 'reviewed', 'approved', 'implemented', 'archived')),
  documented_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, lesson_code)
);

CREATE TABLE IF NOT EXISTS best_practices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  practice_code text NOT NULL,
  practice_title text NOT NULL,
  category text NOT NULL CHECK (category IN ('process', 'quality', 'safety', 'efficiency', 'customer_service', 'innovation', 'risk_management')),
  description text NOT NULL,
  benefits text NOT NULL,
  implementation_steps text,
  requirements text,
  applicable_departments jsonb DEFAULT '[]'::jsonb,
  success_metrics text,
  originating_department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  implementation_count integer DEFAULT 0,
  average_success_rate numeric,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'validated', 'approved', 'active', 'retired')),
  submitted_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, practice_code)
);

CREATE TABLE IF NOT EXISTS improvement_initiatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  budget_period_id uuid NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  initiative_code text NOT NULL,
  initiative_title text NOT NULL,
  initiative_type text NOT NULL CHECK (initiative_type IN ('strategic', 'operational', 'cultural', 'technological', 'process', 'quality')),
  description text NOT NULL,
  objectives text NOT NULL,
  scope text,
  expected_benefits text,
  strategic_goal_id uuid REFERENCES goals(id) ON DELETE SET NULL,
  lesson_learned_id uuid REFERENCES lessons_learned(id) ON DELETE SET NULL,
  best_practice_id uuid REFERENCES best_practices(id) ON DELETE SET NULL,
  champion_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  team_members jsonb DEFAULT '[]'::jsonb,
  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,
  budget_allocated numeric,
  budget_spent numeric,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed', 'approved', 'in_progress', 'completed', 'on_hold', 'cancelled')),
  progress_percentage numeric DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
  status_report text,
  outcomes_achieved text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, initiative_code)
);

CREATE TABLE IF NOT EXISTS knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  article_code text NOT NULL,
  title text NOT NULL,
  category text NOT NULL CHECK (category IN ('procedure', 'guideline', 'template', 'checklist', 'faq', 'tutorial', 'reference')),
  subcategory text,
  content text NOT NULL,
  keywords text[],
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  access_level text NOT NULL DEFAULT 'organization' CHECK (access_level IN ('public', 'organization', 'department', 'restricted')),
  version text DEFAULT '1.0',
  is_published boolean DEFAULT false,
  published_date date,
  review_frequency_months integer DEFAULT 12,
  last_reviewed_date date,
  next_review_date date,
  views_count integer DEFAULT 0,
  helpful_votes integer DEFAULT 0,
  not_helpful_votes integer DEFAULT 0,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, article_code)
);

-- Indexes

CREATE INDEX IF NOT EXISTS idx_risk_culture_assessments_org ON risk_culture_assessments(organization_id, budget_period_id);
CREATE INDEX IF NOT EXISTS idx_risk_culture_indicators_org ON risk_culture_indicators(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_culture_training_org ON risk_culture_training(organization_id);
CREATE INDEX IF NOT EXISTS idx_risk_culture_surveys_org ON risk_culture_surveys(organization_id, budget_period_id);
CREATE INDEX IF NOT EXISTS idx_legal_regulations_active ON legal_regulations(is_active);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_org ON compliance_requirements(organization_id);
CREATE INDEX IF NOT EXISTS idx_compliance_requirements_dept ON compliance_requirements(responsible_department_id);
CREATE INDEX IF NOT EXISTS idx_compliance_assessments_requirement ON compliance_assessments(compliance_requirement_id);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_org ON compliance_violations(organization_id);
CREATE INDEX IF NOT EXISTS idx_compliance_training_org ON compliance_training(organization_id);
CREATE INDEX IF NOT EXISTS idx_lessons_learned_org ON lessons_learned(organization_id);
CREATE INDEX IF NOT EXISTS idx_best_practices_org ON best_practices(organization_id);
CREATE INDEX IF NOT EXISTS idx_improvement_initiatives_org ON improvement_initiatives(organization_id, budget_period_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_org ON knowledge_base(organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_published ON knowledge_base(is_published);

-- Enable RLS

ALTER TABLE risk_culture_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_culture_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_culture_training ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_culture_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_regulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_training ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons_learned ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_practices ENABLE ROW LEVEL SECURITY;
ALTER TABLE improvement_initiatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

-- RLS Policies (efficient patterns)

CREATE POLICY "org_all_risk_culture" ON risk_culture_assessments FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "org_all_risk_indicators" ON risk_culture_indicators FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "org_all_risk_training" ON risk_culture_training FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "org_all_risk_surveys" ON risk_culture_surveys FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "all_select_regulations" ON legal_regulations FOR SELECT TO authenticated USING (true);

CREATE POLICY "org_all_compliance_requirements" ON compliance_requirements FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "org_all_compliance_assessments" ON compliance_assessments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM compliance_requirements cr JOIN profiles pr ON pr.organization_id = cr.organization_id WHERE cr.id = compliance_assessments.compliance_requirement_id AND pr.id = auth.uid()));

CREATE POLICY "org_all_compliance_violations" ON compliance_violations FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "org_all_compliance_training" ON compliance_training FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "org_all_lessons_learned" ON lessons_learned FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "org_all_best_practices" ON best_practices FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "org_all_improvement_initiatives" ON improvement_initiatives FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "org_select_knowledge_base" ON knowledge_base FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()) AND (is_published = true OR author_id = auth.uid()));

CREATE POLICY "author_all_knowledge_base" ON knowledge_base FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director')));

-- Auto-code generation functions

CREATE OR REPLACE FUNCTION generate_risk_culture_code() RETURNS TRIGGER AS $$
DECLARE next_num integer; org_code text; type_code text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM risk_culture_assessments WHERE organization_id = NEW.organization_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NEW.created_at);
  SELECT code INTO org_code FROM organizations WHERE id = NEW.organization_id;
  NEW.assessment_code := org_code || '-RCA-' || TO_CHAR(NEW.created_at, 'YYYY') || '-' || LPAD(next_num::text, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_risk_culture_code BEFORE INSERT ON risk_culture_assessments FOR EACH ROW WHEN (NEW.assessment_code IS NULL OR NEW.assessment_code = '') EXECUTE FUNCTION generate_risk_culture_code();

CREATE OR REPLACE FUNCTION generate_lesson_code() RETURNS TRIGGER AS $$
DECLARE next_num integer; org_code text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM lessons_learned WHERE organization_id = NEW.organization_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NEW.created_at);
  SELECT code INTO org_code FROM organizations WHERE id = NEW.organization_id;
  NEW.lesson_code := org_code || '-LL-' || TO_CHAR(NEW.created_at, 'YYYY') || '-' || LPAD(next_num::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_lesson_code BEFORE INSERT ON lessons_learned FOR EACH ROW WHEN (NEW.lesson_code IS NULL OR NEW.lesson_code = '') EXECUTE FUNCTION generate_lesson_code();
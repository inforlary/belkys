/*
  # Internal Audit Module (İç Denetim Modülü)

  ## Overview
  Comprehensive internal audit system separate from internal control.
  Provides audit planning, execution, findings, and follow-up.

  ## New Tables
  1. internal_audit_universe - Audit universe (auditableentities)
  2. internal_audit_annual_plans - Annual audit plans
  3. internal_audit_programs - Specific audit programs
  4. internal_audit_assignments - Auditor assignments
  5. internal_audit_fieldwork - Audit fieldwork tracking
  6. internal_audit_findings - Detailed audit findings
  7. internal_audit_recommendations - Audit recommendations
  8. internal_audit_reports - Audit reports
  9. internal_audit_follow_ups - Follow-up tracking

  ## Integration Points
  - Links to departments, processes, risks
  - Links to IC findings and CAPA
  - Links to quality audits for coordination

  ## Security
  - RLS enabled with auditor role access
*/

CREATE TABLE IF NOT EXISTS internal_audit_universe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entity_code text NOT NULL,
  entity_name text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('department', 'process', 'system', 'project', 'function')),
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  ic_process_id uuid REFERENCES ic_processes(id) ON DELETE SET NULL,
  description text,
  risk_level text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  last_audit_date date,
  next_planned_audit_date date,
  audit_frequency_months integer DEFAULT 12,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, entity_code)
);

CREATE TABLE IF NOT EXISTS internal_audit_annual_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  budget_period_id uuid NOT NULL REFERENCES budget_periods(id) ON DELETE CASCADE,
  plan_code text NOT NULL,
  plan_title text NOT NULL,
  planning_year integer NOT NULL,
  total_planned_audits integer DEFAULT 0,
  total_audit_hours numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'in_progress', 'completed')),
  approved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, plan_code)
);

CREATE TABLE IF NOT EXISTS internal_audit_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  annual_plan_id uuid NOT NULL REFERENCES internal_audit_annual_plans(id) ON DELETE CASCADE,
  audit_universe_id uuid NOT NULL REFERENCES internal_audit_universe(id) ON DELETE CASCADE,
  program_code text NOT NULL,
  audit_title text NOT NULL,
  audit_type text NOT NULL CHECK (audit_type IN ('financial', 'operational', 'compliance', 'it', 'performance', 'special')),
  audit_objective text NOT NULL,
  audit_scope text NOT NULL,
  planned_start_date date NOT NULL,
  planned_end_date date NOT NULL,
  actual_start_date date,
  actual_end_date date,
  estimated_hours numeric,
  actual_hours numeric,
  lead_auditor_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'fieldwork_complete', 'draft_report', 'final_report', 'closed')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, program_code)
);

CREATE TABLE IF NOT EXISTS internal_audit_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_program_id uuid NOT NULL REFERENCES internal_audit_programs(id) ON DELETE CASCADE,
  auditor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('lead', 'team_member', 'specialist', 'observer')),
  assigned_hours numeric,
  actual_hours numeric,
  assignment_date date NOT NULL DEFAULT CURRENT_DATE,
  completion_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(audit_program_id, auditor_id)
);

CREATE TABLE IF NOT EXISTS internal_audit_fieldwork (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_program_id uuid NOT NULL REFERENCES internal_audit_programs(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  activity_description text NOT NULL,
  auditor_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  hours_spent numeric,
  documents_reviewed text,
  interviews_conducted text,
  observations text,
  preliminary_findings text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS internal_audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  audit_program_id uuid NOT NULL REFERENCES internal_audit_programs(id) ON DELETE CASCADE,
  finding_code text NOT NULL,
  finding_title text NOT NULL,
  finding_type text NOT NULL CHECK (finding_type IN ('significant', 'moderate', 'minor', 'observation', 'best_practice')),
  severity text NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  condition_found text NOT NULL,
  criteria text NOT NULL,
  cause text,
  effect text,
  risk_rating text NOT NULL CHECK (risk_rating IN ('critical', 'high', 'medium', 'low')),
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  responsible_person_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ic_finding_id uuid REFERENCES ic_findings(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, finding_code)
);

CREATE TABLE IF NOT EXISTS internal_audit_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_finding_id uuid NOT NULL REFERENCES internal_audit_findings(id) ON DELETE CASCADE,
  recommendation_number integer NOT NULL,
  recommendation_text text NOT NULL,
  management_response text,
  agreed_action_plan text,
  responsible_person_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  target_completion_date date,
  actual_completion_date date,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'implemented', 'not_implemented', 'superseded')),
  implementation_evidence text,
  verified_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(audit_finding_id, recommendation_number)
);

CREATE TABLE IF NOT EXISTS internal_audit_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  audit_program_id uuid NOT NULL REFERENCES internal_audit_programs(id) ON DELETE CASCADE,
  report_code text NOT NULL,
  report_title text NOT NULL,
  report_type text NOT NULL CHECK (report_type IN ('draft', 'final', 'management_letter', 'follow_up')),
  report_date date NOT NULL,
  executive_summary text,
  background text,
  audit_objective text,
  audit_scope text,
  audit_methodology text,
  overall_opinion text CHECK (overall_opinion IN ('satisfactory', 'needs_improvement', 'unsatisfactory', 'qualified')),
  key_findings_summary text,
  conclusions text,
  recommendations_summary text,
  issued_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  issued_at timestamptz,
  distributed_to jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'final', 'distributed')),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(organization_id, report_code)
);

CREATE TABLE IF NOT EXISTS internal_audit_follow_ups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  audit_recommendation_id uuid NOT NULL REFERENCES internal_audit_recommendations(id) ON DELETE CASCADE,
  follow_up_date date NOT NULL,
  follow_up_type text NOT NULL CHECK (follow_up_type IN ('routine', 'special', 'verification')),
  implementation_status text NOT NULL CHECK (implementation_status IN ('not_started', 'in_progress', 'substantially_complete', 'complete')),
  auditor_notes text,
  management_update text,
  evidence_reviewed text,
  next_follow_up_date date,
  followed_up_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_universe_org ON internal_audit_universe(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_universe_dept ON internal_audit_universe(department_id);
CREATE INDEX IF NOT EXISTS idx_annual_plans_org_period ON internal_audit_annual_plans(organization_id, budget_period_id);
CREATE INDEX IF NOT EXISTS idx_audit_programs_org ON internal_audit_programs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_programs_plan ON internal_audit_programs(annual_plan_id);
CREATE INDEX IF NOT EXISTS idx_audit_assignments_program ON internal_audit_assignments(audit_program_id);
CREATE INDEX IF NOT EXISTS idx_audit_assignments_auditor ON internal_audit_assignments(auditor_id);
CREATE INDEX IF NOT EXISTS idx_audit_fieldwork_program ON internal_audit_fieldwork(audit_program_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_org ON internal_audit_findings(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_program ON internal_audit_findings(audit_program_id);
CREATE INDEX IF NOT EXISTS idx_audit_recommendations_finding ON internal_audit_recommendations(audit_finding_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_org ON internal_audit_reports(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_reports_program ON internal_audit_reports(audit_program_id);
CREATE INDEX IF NOT EXISTS idx_audit_followups_org ON internal_audit_follow_ups(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_followups_recommendation ON internal_audit_follow_ups(audit_recommendation_id);

ALTER TABLE internal_audit_universe ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_audit_annual_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_audit_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_audit_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_audit_fieldwork ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_audit_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_audit_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE internal_audit_follow_ups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_select_audit_universe" ON internal_audit_universe FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "auditor_all_audit_universe" ON internal_audit_universe FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = internal_audit_universe.organization_id AND role IN ('admin', 'auditor')));

CREATE POLICY "org_select_annual_plans" ON internal_audit_annual_plans FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "auditor_all_annual_plans" ON internal_audit_annual_plans FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = internal_audit_annual_plans.organization_id AND role IN ('admin', 'auditor')));

CREATE POLICY "org_select_audit_programs" ON internal_audit_programs FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "auditor_all_audit_programs" ON internal_audit_programs FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = internal_audit_programs.organization_id AND role IN ('admin', 'auditor')));

CREATE POLICY "assigned_select_assignments" ON internal_audit_assignments FOR SELECT TO authenticated
  USING (auditor_id = auth.uid() OR EXISTS (SELECT 1 FROM internal_audit_programs p JOIN profiles pr ON pr.organization_id = p.organization_id WHERE p.id = internal_audit_assignments.audit_program_id AND pr.id = auth.uid() AND pr.role IN ('admin', 'auditor')));

CREATE POLICY "auditor_all_assignments" ON internal_audit_assignments FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM internal_audit_programs p JOIN profiles pr ON pr.organization_id = p.organization_id WHERE p.id = internal_audit_assignments.audit_program_id AND pr.id = auth.uid() AND pr.role IN ('admin', 'auditor')));

CREATE POLICY "assigned_select_fieldwork" ON internal_audit_fieldwork FOR SELECT TO authenticated
  USING (auditor_id = auth.uid() OR EXISTS (SELECT 1 FROM internal_audit_programs p JOIN profiles pr ON pr.organization_id = p.organization_id WHERE p.id = internal_audit_fieldwork.audit_program_id AND pr.id = auth.uid() AND pr.role IN ('admin', 'auditor')));

CREATE POLICY "auditor_all_fieldwork" ON internal_audit_fieldwork FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM internal_audit_programs p JOIN profiles pr ON pr.organization_id = p.organization_id WHERE p.id = internal_audit_fieldwork.audit_program_id AND pr.id = auth.uid() AND pr.role IN ('admin', 'auditor')));

CREATE POLICY "org_select_audit_findings" ON internal_audit_findings FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "auditor_all_audit_findings" ON internal_audit_findings FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = internal_audit_findings.organization_id AND role IN ('admin', 'auditor')));

CREATE POLICY "org_select_recommendations" ON internal_audit_recommendations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM internal_audit_findings f JOIN profiles pr ON pr.organization_id = f.organization_id WHERE f.id = internal_audit_recommendations.audit_finding_id AND pr.id = auth.uid()));

CREATE POLICY "auditor_all_recommendations" ON internal_audit_recommendations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM internal_audit_findings f JOIN profiles pr ON pr.organization_id = f.organization_id WHERE f.id = internal_audit_recommendations.audit_finding_id AND pr.id = auth.uid() AND pr.role IN ('admin', 'auditor')));

CREATE POLICY "org_select_audit_reports" ON internal_audit_reports FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "auditor_all_audit_reports" ON internal_audit_reports FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = internal_audit_reports.organization_id AND role IN ('admin', 'auditor')));

CREATE POLICY "org_select_follow_ups" ON internal_audit_follow_ups FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "auditor_all_follow_ups" ON internal_audit_follow_ups FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND organization_id = internal_audit_follow_ups.organization_id AND role IN ('admin', 'auditor')));

CREATE OR REPLACE FUNCTION generate_audit_plan_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
  org_code text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM internal_audit_annual_plans
  WHERE organization_id = NEW.organization_id AND planning_year = NEW.planning_year;
  SELECT code INTO org_code FROM organizations WHERE id = NEW.organization_id;
  NEW.plan_code := org_code || '-IAP-' || NEW.planning_year::text || '-' || LPAD(next_num::text, 2, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_audit_plan_code BEFORE INSERT ON internal_audit_annual_plans
FOR EACH ROW WHEN (NEW.plan_code IS NULL OR NEW.plan_code = '') EXECUTE FUNCTION generate_audit_plan_code();

CREATE OR REPLACE FUNCTION generate_audit_program_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
  org_code text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM internal_audit_programs
  WHERE organization_id = NEW.organization_id AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NEW.created_at);
  SELECT code INTO org_code FROM organizations WHERE id = NEW.organization_id;
  NEW.program_code := org_code || '-IA-' || TO_CHAR(NEW.created_at, 'YYYY') || '-' || LPAD(next_num::text, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_audit_program_code BEFORE INSERT ON internal_audit_programs
FOR EACH ROW WHEN (NEW.program_code IS NULL OR NEW.program_code = '') EXECUTE FUNCTION generate_audit_program_code();

CREATE OR REPLACE FUNCTION generate_audit_finding_code()
RETURNS TRIGGER AS $$
DECLARE
  next_num integer;
  org_code text;
  program_code text;
BEGIN
  SELECT COUNT(*) + 1 INTO next_num FROM internal_audit_findings
  WHERE audit_program_id = NEW.audit_program_id;
  SELECT p.program_code INTO program_code FROM internal_audit_programs p WHERE p.id = NEW.audit_program_id;
  NEW.finding_code := program_code || '-F' || LPAD(next_num::text, 2, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_audit_finding_code BEFORE INSERT ON internal_audit_findings
FOR EACH ROW WHEN (NEW.finding_code IS NULL OR NEW.finding_code = '') EXECUTE FUNCTION generate_audit_finding_code();

CREATE OR REPLACE FUNCTION generate_audit_report_code()
RETURNS TRIGGER AS $$
DECLARE
  program_code text;
BEGIN
  SELECT p.program_code INTO program_code FROM internal_audit_programs p WHERE p.id = NEW.audit_program_id;
  NEW.report_code := program_code || '-R-' || UPPER(LEFT(NEW.report_type, 1));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER set_audit_report_code BEFORE INSERT ON internal_audit_reports
FOR EACH ROW WHEN (NEW.report_code IS NULL OR NEW.report_code = '') EXECUTE FUNCTION generate_audit_report_code();
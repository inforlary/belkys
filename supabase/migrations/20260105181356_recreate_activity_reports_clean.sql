/*
  # Recreate Activity Reports Module - Clean Installation

  1. Changes
    - Drop ALL existing activity_reports related objects (tables, indexes, functions)
    - Create comprehensive activity reports system with new structure
    - Add integration with Strategic Plan, Performance Program, Budget, Risk, and Internal Control modules

  2. New Tables
    - activity_reports: Main report records
    - report_sections: Report sections with JSONB content
    - report_performance_data: Performance indicators data
    - report_budget_data: Budget execution data
    - report_activity_entries: Unit activity entries
    - report_tables: Dynamic tables for reports
    - report_attachments: File attachments
    - report_comments: Section-based comments
    - report_workflow: Workflow status transitions

  3. Security
    - Enable RLS on all tables
    - Role-based access control
    - Organization-level data isolation
*/

-- Drop all existing indexes first
DROP INDEX IF EXISTS idx_report_comments_report CASCADE;
DROP INDEX IF EXISTS idx_report_comments_user CASCADE;
DROP INDEX IF EXISTS idx_report_deadlines_dept CASCADE;
DROP INDEX IF EXISTS idx_report_deadlines_org CASCADE;
DROP INDEX IF EXISTS idx_report_deadlines_period CASCADE;
DROP INDEX IF EXISTS idx_report_executions_org CASCADE;
DROP INDEX IF EXISTS idx_report_executions_report CASCADE;
DROP INDEX IF EXISTS idx_report_notifications_report CASCADE;
DROP INDEX IF EXISTS idx_report_notifications_user CASCADE;
DROP INDEX IF EXISTS idx_report_sections_report CASCADE;
DROP INDEX IF EXISTS idx_report_templates_active CASCADE;
DROP INDEX IF EXISTS idx_report_versions_number CASCADE;

-- Drop existing tables CASCADE
DROP TABLE IF EXISTS activity_report_workflow_approvals CASCADE;
DROP TABLE IF EXISTS activity_report_workflow_stages CASCADE;
DROP TABLE IF EXISTS activity_report_versions CASCADE;
DROP TABLE IF EXISTS activity_report_notifications CASCADE;
DROP TABLE IF EXISTS activity_report_deadlines CASCADE;
DROP TABLE IF EXISTS activity_report_comments CASCADE;
DROP TABLE IF EXISTS activity_report_attachments CASCADE;
DROP TABLE IF EXISTS activity_report_templates CASCADE;
DROP TABLE IF EXISTS activity_reports CASCADE;
DROP TABLE IF EXISTS report_sections CASCADE;
DROP TABLE IF EXISTS report_performance_data CASCADE;
DROP TABLE IF EXISTS report_budget_data CASCADE;
DROP TABLE IF EXISTS report_activity_entries CASCADE;
DROP TABLE IF EXISTS report_tables CASCADE;
DROP TABLE IF EXISTS report_attachments CASCADE;
DROP TABLE IF EXISTS report_comments CASCADE;
DROP TABLE IF EXISTS report_workflow CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS update_report_completion() CASCADE;
DROP FUNCTION IF EXISTS log_report_workflow() CASCADE;

-- Create main activity_reports table
CREATE TABLE activity_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  year integer NOT NULL,
  
  type text NOT NULL CHECK (type IN ('UNIT', 'INSTITUTION')),
  unit_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  
  title text NOT NULL,
  description text,
  
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
    'DRAFT', 'UNIT_SUBMITTED', 'CONSOLIDATING', 'REVIEW', 'APPROVED', 'PUBLISHED'
  )),
  
  prepared_by_id uuid REFERENCES profiles(id),
  approved_by_id uuid REFERENCES profiles(id),
  reviewed_by_id uuid REFERENCES profiles(id),
  
  submission_deadline date,
  submitted_at timestamptz,
  approved_at timestamptz,
  reviewed_at timestamptz,
  published_at timestamptz,
  
  completion_percentage integer DEFAULT 0 CHECK (completion_percentage BETWEEN 0 AND 100),
  completed_sections jsonb DEFAULT '[]'::jsonb,
  
  metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(organization_id, year, type, unit_id)
);

-- Create report_sections table
CREATE TABLE report_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES activity_reports(id) ON DELETE CASCADE,
  
  section_code text NOT NULL,
  section_name text NOT NULL,
  parent_section_code text,
  order_index integer NOT NULL,
  
  content jsonb DEFAULT '{}'::jsonb,
  html_content text,
  
  is_auto_generated boolean DEFAULT false,
  auto_data_source text,
  last_synced_at timestamptz,
  
  is_locked boolean DEFAULT false,
  is_completed boolean DEFAULT false,
  locked_by_id uuid REFERENCES profiles(id),
  locked_at timestamptz,
  
  metadata jsonb DEFAULT '{}'::jsonb,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(report_id, section_code)
);

-- Create report_performance_data table
CREATE TABLE report_performance_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES activity_reports(id) ON DELETE CASCADE,
  
  objective_id uuid REFERENCES objectives(id) ON DELETE SET NULL,
  indicator_id uuid REFERENCES indicators(id) ON DELETE SET NULL,
  
  target_value numeric,
  actual_value numeric,
  realization_rate numeric,
  
  deviation numeric,
  deviation_reason text,
  corrective_actions text,
  
  status text DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved')),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(report_id, indicator_id)
);

-- Create report_budget_data table
CREATE TABLE report_budget_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES activity_reports(id) ON DELETE CASCADE,
  
  program_id uuid REFERENCES programs(id) ON DELETE SET NULL,
  sub_program_id uuid REFERENCES sub_programs(id) ON DELETE SET NULL,
  
  initial_appropriation numeric DEFAULT 0,
  revised_appropriation numeric DEFAULT 0,
  accrual numeric DEFAULT 0,
  payment numeric DEFAULT 0,
  realization_rate numeric,
  
  explanation text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(report_id, program_id, sub_program_id)
);

-- Create report_activity_entries table
CREATE TABLE report_activity_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES activity_reports(id) ON DELETE CASCADE,
  unit_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  
  activity_title text NOT NULL,
  activity_description text,
  
  start_date date,
  end_date date,
  
  outputs text,
  outcomes text,
  resources_used text,
  challenges text,
  
  photos jsonb DEFAULT '[]'::jsonb,
  
  order_index integer DEFAULT 0,
  
  created_by_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create report_tables table
CREATE TABLE report_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES activity_reports(id) ON DELETE CASCADE,
  
  section_code text NOT NULL,
  table_name text NOT NULL,
  table_type text CHECK (table_type IN (
    'PERFORMANCE_SUMMARY', 'BUDGET_SUMMARY', 'INDICATOR_TABLE', 
    'RESOURCE_TABLE', 'CUSTOM'
  )),
  
  table_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  order_index integer DEFAULT 0,
  is_visible boolean DEFAULT true,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create report_attachments table
CREATE TABLE report_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES activity_reports(id) ON DELETE CASCADE,
  
  name text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  
  order_index integer DEFAULT 0,
  
  uploaded_by_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Create report_comments table
CREATE TABLE report_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES activity_reports(id) ON DELETE CASCADE,
  
  section_code text,
  
  comment_text text NOT NULL,
  comment_type text DEFAULT 'general' CHECK (comment_type IN ('general', 'revision', 'approval', 'question')),
  
  is_resolved boolean DEFAULT false,
  resolved_by_id uuid REFERENCES profiles(id),
  resolved_at timestamptz,
  resolution_note text,
  
  commented_by_id uuid REFERENCES profiles(id),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create report_workflow table
CREATE TABLE report_workflow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES activity_reports(id) ON DELETE CASCADE,
  
  from_status text NOT NULL,
  to_status text NOT NULL,
  action text NOT NULL CHECK (action IN ('SUBMIT', 'RETURN', 'APPROVE', 'PUBLISH', 'REJECT', 'REVISE')),
  
  action_by_id uuid REFERENCES profiles(id),
  action_date timestamptz DEFAULT now(),
  notes text,
  
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_activity_reports_org ON activity_reports(organization_id);
CREATE INDEX idx_activity_reports_year ON activity_reports(year);
CREATE INDEX idx_activity_reports_type ON activity_reports(type);
CREATE INDEX idx_activity_reports_status ON activity_reports(status);
CREATE INDEX idx_activity_reports_unit ON activity_reports(unit_id);

CREATE INDEX idx_report_sections_report ON report_sections(report_id);
CREATE INDEX idx_report_sections_code ON report_sections(section_code);
CREATE INDEX idx_report_sections_order ON report_sections(order_index);

CREATE INDEX idx_report_performance_report ON report_performance_data(report_id);
CREATE INDEX idx_report_performance_indicator ON report_performance_data(indicator_id);

CREATE INDEX idx_report_budget_report ON report_budget_data(report_id);
CREATE INDEX idx_report_budget_program ON report_budget_data(program_id);

CREATE INDEX idx_report_activities_report ON report_activity_entries(report_id);
CREATE INDEX idx_report_activities_unit ON report_activity_entries(unit_id);

CREATE INDEX idx_report_tables_report ON report_tables(report_id);
CREATE INDEX idx_report_tables_section ON report_tables(section_code);

CREATE INDEX idx_report_attachments_report ON report_attachments(report_id);

CREATE INDEX idx_report_comments_report_new ON report_comments(report_id);
CREATE INDEX idx_report_comments_section ON report_comments(section_code);

CREATE INDEX idx_report_workflow_report ON report_workflow(report_id);
CREATE INDEX idx_report_workflow_date ON report_workflow(action_date);

-- Enable RLS
ALTER TABLE activity_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_performance_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_budget_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_activity_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_workflow ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "org_select_reports" ON activity_reports FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true));

CREATE POLICY "org_insert_reports" ON activity_reports FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'director', 'vice_president')) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true));

CREATE POLICY "org_update_reports" ON activity_reports FOR UPDATE TO authenticated
  USING ((organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vice_president'))) OR (type = 'UNIT' AND unit_id IN (SELECT department_id FROM profiles WHERE id = auth.uid() AND role = 'director')) OR prepared_by_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true));

CREATE POLICY "org_delete_reports" ON activity_reports FOR DELETE TO authenticated
  USING (status = 'DRAFT' AND (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vice_president')) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true)));

CREATE POLICY "org_all_sections" ON report_sections FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true));

CREATE POLICY "org_all_performance" ON report_performance_data FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true));

CREATE POLICY "org_all_budget" ON report_budget_data FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true));

CREATE POLICY "org_all_activities" ON report_activity_entries FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true));

CREATE POLICY "org_all_tables" ON report_tables FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true));

CREATE POLICY "org_select_attachments" ON report_attachments FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true));

CREATE POLICY "org_insert_attachments" ON report_attachments FOR INSERT TO authenticated
  WITH CHECK (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true));

CREATE POLICY "org_delete_attachments" ON report_attachments FOR DELETE TO authenticated
  USING (uploaded_by_id = auth.uid() OR organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'vice_president')) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true));

CREATE POLICY "org_all_comments" ON report_comments FOR ALL TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true));

CREATE POLICY "org_select_workflow" ON report_workflow FOR SELECT TO authenticated
  USING (organization_id IN (SELECT organization_id FROM profiles WHERE id = auth.uid()) OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_super_admin = true));

CREATE POLICY "org_insert_workflow" ON report_workflow FOR INSERT TO authenticated
  WITH CHECK (true);

-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('report-attachments', 'report-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Users upload report attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'report-attachments');
CREATE POLICY "Users view report attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'report-attachments');
CREATE POLICY "Users delete report attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'report-attachments');

-- Functions
CREATE OR REPLACE FUNCTION update_report_completion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_total integer;
  v_completed integer;
  v_percentage integer;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_completed = true)
  INTO v_total, v_completed
  FROM report_sections
  WHERE report_id = COALESCE(NEW.report_id, OLD.report_id);
  
  v_percentage := CASE WHEN v_total > 0 THEN ROUND((v_completed::numeric / v_total::numeric) * 100) ELSE 0 END;
  
  UPDATE activity_reports SET completion_percentage = v_percentage, updated_at = now() WHERE id = COALESCE(NEW.report_id, OLD.report_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_update_report_completion AFTER INSERT OR UPDATE OF is_completed OR DELETE ON report_sections FOR EACH ROW EXECUTE FUNCTION update_report_completion();

CREATE OR REPLACE FUNCTION log_report_workflow()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO report_workflow (organization_id, report_id, from_status, to_status, action, action_by_id, action_date)
    VALUES (NEW.organization_id, NEW.id, COALESCE(OLD.status, 'DRAFT'), NEW.status,
      CASE NEW.status WHEN 'UNIT_SUBMITTED' THEN 'SUBMIT' WHEN 'CONSOLIDATING' THEN 'SUBMIT' WHEN 'REVIEW' THEN 'SUBMIT' WHEN 'APPROVED' THEN 'APPROVE' WHEN 'PUBLISHED' THEN 'PUBLISH' ELSE 'REVISE' END,
      auth.uid(), now());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_report_workflow AFTER UPDATE OF status ON activity_reports FOR EACH ROW EXECUTE FUNCTION log_report_workflow();
